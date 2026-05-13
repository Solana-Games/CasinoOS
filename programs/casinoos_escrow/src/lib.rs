use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    hash::hashv,
    program::{invoke, invoke_signed},
    system_instruction,
};

declare_id!("Casin0s111111111111111111111111111111111111");

const BPS_DENOMINATOR: u64 = 10_000;
const MAX_RTP_BPS: u16 = 9_800;
const MIN_RTP_BPS: u16 = 9_000;

#[program]
pub mod casinoos_escrow {
    use super::*;

    pub fn initialize_house(
        ctx: Context<InitializeHouse>,
        fee_bps: u16,
        jackpot_bps: u16,
        min_bet_lamports: u64,
        max_bet_lamports: u64,
    ) -> Result<()> {
        require!(fee_bps <= 1_000, CasinoError::InvalidFeeBps);
        require!(jackpot_bps <= 2_000, CasinoError::InvalidJackpotBps);
        require!(min_bet_lamports > 0, CasinoError::InvalidBetBounds);
        require!(max_bet_lamports > min_bet_lamports, CasinoError::InvalidBetBounds);

        let house = &mut ctx.accounts.house;
        house.authority = ctx.accounts.authority.key();
        house.treasury = ctx.accounts.treasury.key();
        house.jackpot_vault = ctx.accounts.jackpot_vault.key();
        house.nft_multiplier_registry = ctx.accounts.nft_multiplier_registry.key();
        house.fee_bps = fee_bps;
        house.jackpot_bps = jackpot_bps;
        house.min_bet_lamports = min_bet_lamports;
        house.max_bet_lamports = max_bet_lamports;
        house.bump = ctx.bumps.house;
        house.paused = false;
        Ok(())
    }

    pub fn configure_house(
        ctx: Context<ConfigureHouse>,
        fee_bps: u16,
        jackpot_bps: u16,
        min_bet_lamports: u64,
        max_bet_lamports: u64,
        paused: bool,
    ) -> Result<()> {
        require!(fee_bps <= 1_000, CasinoError::InvalidFeeBps);
        require!(jackpot_bps <= 2_000, CasinoError::InvalidJackpotBps);
        require!(max_bet_lamports > min_bet_lamports && min_bet_lamports > 0, CasinoError::InvalidBetBounds);

        let house = &mut ctx.accounts.house;
        house.fee_bps = fee_bps;
        house.jackpot_bps = jackpot_bps;
        house.min_bet_lamports = min_bet_lamports;
        house.max_bet_lamports = max_bet_lamports;
        house.paused = paused;
        Ok(())
    }

    pub fn set_nft_multiplier(
        ctx: Context<SetNftMultiplier>,
        collection: Pubkey,
        multiplier_bps: u16,
    ) -> Result<()> {
        require!(multiplier_bps >= 10_000 && multiplier_bps <= 25_000, CasinoError::InvalidNftMultiplier);
        let registry = &mut ctx.accounts.nft_multiplier_registry;
        registry.collection = collection;
        registry.multiplier_bps = multiplier_bps;
        registry.updated_at = Clock::get()?.unix_timestamp;
        registry.bump = ctx.bumps.nft_multiplier_registry;
        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount_lamports: u64,
        client_seed_hash: [u8; 32],
        commit_hash: [u8; 32],
        nonce: u64,
    ) -> Result<()> {
        let house = &ctx.accounts.house;
        require!(!house.paused, CasinoError::HousePaused);
        require!(amount_lamports >= house.min_bet_lamports, CasinoError::BetTooSmall);
        require!(amount_lamports <= house.max_bet_lamports, CasinoError::BetTooLarge);

        let round = &mut ctx.accounts.round;
        round.player = ctx.accounts.player.key();
        round.house = house.key();
        round.amount_lamports = amount_lamports;
        round.client_seed_hash = client_seed_hash;
        round.commit_hash = commit_hash;
        round.nonce = nonce;
        round.created_at = Clock::get()?.unix_timestamp;
        round.resolved = false;
        round.payout_lamports = 0;
        round.bump = ctx.bumps.round;

        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.player.key(),
            &ctx.accounts.treasury.key(),
            amount_lamports,
        );
        invoke(
            &transfer_ix,
            &[
                ctx.accounts.player.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        emit!(BetPlaced {
            player: round.player,
            round: round.key(),
            amount_lamports,
            nonce,
        });

        Ok(())
    }

    pub fn reveal_and_settle(
        ctx: Context<RevealAndSettle>,
        server_seed: [u8; 32],
        client_seed: [u8; 32],
        payout_lamports: u64,
        jackpot_win_lamports: u64,
        nft_collection: Pubkey,
    ) -> Result<()> {
        let round = &mut ctx.accounts.round;
        require!(!round.resolved, CasinoError::RoundAlreadyResolved);

        let recomputed_client_hash = hashv(&[&client_seed]).to_bytes();
        require!(recomputed_client_hash == round.client_seed_hash, CasinoError::ClientSeedHashMismatch);

        let commit = hashv(&[
            &server_seed,
            &client_seed,
            &round.nonce.to_le_bytes(),
            round.player.as_ref(),
        ])
        .to_bytes();
        require!(commit == round.commit_hash, CasinoError::CommitHashMismatch);

        let house = &ctx.accounts.house;
        let fee = round.amount_lamports
            .checked_mul(house.fee_bps as u64)
            .ok_or(CasinoError::ArithmeticOverflow)?
            / BPS_DENOMINATOR;
        let jackpot_contribution = round
            .amount_lamports
            .checked_mul(house.jackpot_bps as u64)
            .ok_or(CasinoError::ArithmeticOverflow)?
            / BPS_DENOMINATOR;

        let base_cap = round.amount_lamports
            .checked_mul(MAX_RTP_BPS as u64)
            .ok_or(CasinoError::ArithmeticOverflow)?
            / BPS_DENOMINATOR;
        require!(payout_lamports <= base_cap.saturating_mul(20), CasinoError::PayoutCapExceeded);

        let mut final_payout = payout_lamports;
        if nft_collection == ctx.accounts.nft_multiplier_registry.collection {
            let boost = final_payout
                .checked_mul(ctx.accounts.nft_multiplier_registry.multiplier_bps as u64)
                .ok_or(CasinoError::ArithmeticOverflow)?
                / BPS_DENOMINATOR;
            final_payout = boost;
        }

        if jackpot_contribution > 0 {
            let transfer_ix = system_instruction::transfer(
                &ctx.accounts.treasury.key(),
                &ctx.accounts.jackpot_vault.key(),
                jackpot_contribution,
            );
            invoke_signed(
                &transfer_ix,
                &[
                    ctx.accounts.treasury.to_account_info(),
                    ctx.accounts.jackpot_vault.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[&[b"house", house.authority.as_ref(), &[house.bump]]],
            )?;
        }

        let payout_from_treasury = final_payout.saturating_sub(jackpot_win_lamports);

        if payout_from_treasury > 0 {
            let transfer_ix = system_instruction::transfer(
                &ctx.accounts.treasury.key(),
                &ctx.accounts.player.key(),
                payout_from_treasury,
            );
            invoke_signed(
                &transfer_ix,
                &[
                    ctx.accounts.treasury.to_account_info(),
                    ctx.accounts.player.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[&[b"house", house.authority.as_ref(), &[house.bump]]],
            )?;
        }

        if jackpot_win_lamports > 0 {
            let jackpot_ix = system_instruction::transfer(
                &ctx.accounts.jackpot_vault.key(),
                &ctx.accounts.player.key(),
                jackpot_win_lamports,
            );
            invoke_signed(
                &jackpot_ix,
                &[
                    ctx.accounts.jackpot_vault.to_account_info(),
                    ctx.accounts.player.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[&[b"jackpot", house.authority.as_ref(), &[ctx.accounts.house.bump]]],
            )?;
        }

        round.resolved = true;
        round.payout_lamports = final_payout;

        emit!(RoundSettled {
            player: round.player,
            round: round.key(),
            payout_lamports: final_payout,
            fee_lamports: fee,
            jackpot_contribution_lamports: jackpot_contribution,
            jackpot_win_lamports,
            rtp_floor_bps: MIN_RTP_BPS,
            rtp_ceiling_bps: MAX_RTP_BPS,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeHouse<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        seeds = [b"house", authority.key().as_ref()],
        bump,
        space = 8 + House::SIZE
    )]
    pub house: Account<'info, House>,
    /// CHECK: PDA treasury vault for SOL custody.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: PDA jackpot vault for pooled jackpots.
    #[account(mut)]
    pub jackpot_vault: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        seeds = [b"nft-multiplier", authority.key().as_ref()],
        bump,
        space = 8 + NftMultiplierRegistry::SIZE
    )]
    pub nft_multiplier_registry: Account<'info, NftMultiplierRegistry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfigureHouse<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub house: Account<'info, House>,
}

#[derive(Accounts)]
pub struct SetNftMultiplier<'info> {
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub house: Account<'info, House>,
    #[account(
        mut,
        seeds = [b"nft-multiplier", authority.key().as_ref()],
        bump
    )]
    pub nft_multiplier_registry: Account<'info, NftMultiplierRegistry>,
}

#[derive(Accounts)]
#[instruction(_amount_lamports: u64, _client_seed_hash: [u8; 32], _commit_hash: [u8; 32], nonce: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub house: Account<'info, House>,
    /// CHECK: House treasury account.
    #[account(mut, address = house.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = player,
        seeds = [b"round", player.key().as_ref(), &nonce.to_le_bytes()],
        bump,
        space = 8 + Round::SIZE
    )]
    pub round: Account<'info, Round>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealAndSettle<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub house: Account<'info, House>,
    #[account(mut, has_one = player, has_one = house)]
    pub round: Account<'info, Round>,
    /// CHECK: House treasury.
    #[account(mut, address = house.treasury)]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: House jackpot vault.
    #[account(mut, address = house.jackpot_vault)]
    pub jackpot_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub player: UncheckedAccount<'info>,
    #[account(address = house.nft_multiplier_registry)]
    pub nft_multiplier_registry: Account<'info, NftMultiplierRegistry>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct House {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub jackpot_vault: Pubkey,
    pub nft_multiplier_registry: Pubkey,
    pub fee_bps: u16,
    pub jackpot_bps: u16,
    pub min_bet_lamports: u64,
    pub max_bet_lamports: u64,
    pub paused: bool,
    pub bump: u8,
}

impl House {
    pub const SIZE: usize = 32 + 32 + 32 + 32 + 2 + 2 + 8 + 8 + 1 + 1;
}

#[account]
pub struct Round {
    pub player: Pubkey,
    pub house: Pubkey,
    pub amount_lamports: u64,
    pub client_seed_hash: [u8; 32],
    pub commit_hash: [u8; 32],
    pub nonce: u64,
    pub payout_lamports: u64,
    pub created_at: i64,
    pub resolved: bool,
    pub bump: u8,
}

impl Round {
    pub const SIZE: usize = 32 + 32 + 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[account]
pub struct NftMultiplierRegistry {
    pub collection: Pubkey,
    pub multiplier_bps: u16,
    pub updated_at: i64,
    pub bump: u8,
}

impl NftMultiplierRegistry {
    pub const SIZE: usize = 32 + 2 + 8 + 1;
}

#[event]
pub struct BetPlaced {
    pub player: Pubkey,
    pub round: Pubkey,
    pub amount_lamports: u64,
    pub nonce: u64,
}

#[event]
pub struct RoundSettled {
    pub player: Pubkey,
    pub round: Pubkey,
    pub payout_lamports: u64,
    pub fee_lamports: u64,
    pub jackpot_contribution_lamports: u64,
    pub jackpot_win_lamports: u64,
    pub rtp_floor_bps: u16,
    pub rtp_ceiling_bps: u16,
}

#[error_code]
pub enum CasinoError {
    #[msg("invalid fee bps")]
    InvalidFeeBps,
    #[msg("invalid jackpot bps")]
    InvalidJackpotBps,
    #[msg("invalid bet bounds")]
    InvalidBetBounds,
    #[msg("house paused")]
    HousePaused,
    #[msg("bet below minimum")]
    BetTooSmall,
    #[msg("bet above maximum")]
    BetTooLarge,
    #[msg("round already resolved")]
    RoundAlreadyResolved,
    #[msg("commit hash mismatch")]
    CommitHashMismatch,
    #[msg("client seed hash mismatch")]
    ClientSeedHashMismatch,
    #[msg("payout cap exceeded")]
    PayoutCapExceeded,
    #[msg("invalid nft multiplier")]
    InvalidNftMultiplier,
    #[msg("arithmetic overflow")]
    ArithmeticOverflow,
}
