use anchor_lang::prelude::*;
use anchor_lang::solana_program::{hash::hashv, system_instruction};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgP9G6fN4jJ");

const BPS_DENOMINATOR: u64 = 10_000;
const MAX_PAYOUTS: usize = 64;
const JACKPOT_TRIGGER_BYTE: u8 = 0;

#[program]
pub mod casinoos_escrow {
    use super::*;

    pub fn initialize_house(ctx: Context<InitializeHouse>, fee_bps: u16, jackpot_bps: u16) -> Result<()> {
        require!(
            (fee_bps as u64) + (jackpot_bps as u64) <= BPS_DENOMINATOR,
            CasinoError::InvalidBps
        );

        let house = &mut ctx.accounts.house;
        house.authority = ctx.accounts.authority.key();
        house.treasury = ctx.accounts.treasury.key();
        house.fee_bps = fee_bps;
        house.jackpot_bps = jackpot_bps;
        house.bump = ctx.bumps.house;
        house.jackpot_bump = ctx.bumps.jackpot_vault;
        Ok(())
    }

    pub fn create_round(
        ctx: Context<CreateRound>,
        round_id: u64,
        commit_hash: [u8; 32],
        min_bet_lamports: u64,
        close_slot: u64,
    ) -> Result<()> {
        require!(close_slot > Clock::get()?.slot, CasinoError::RoundAlreadyClosed);
        require!(min_bet_lamports > 0, CasinoError::InvalidBetAmount);

        let round = &mut ctx.accounts.round;
        round.round_id = round_id;
        round.house = ctx.accounts.house.key();
        round.commit_hash = commit_hash;
        round.min_bet_lamports = min_bet_lamports;
        round.close_slot = close_slot;
        round.total_wager_lamports = 0;
        round.settled = false;
        round.player_count = 0;
        round.bump = ctx.bumps.round;
        round.escrow_bump = ctx.bumps.escrow;
        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, amount_lamports: u64, nft_multiplier_bps: u16) -> Result<()> {
        require!(!ctx.accounts.round.settled, CasinoError::RoundSettled);
        require!(Clock::get()?.slot <= ctx.accounts.round.close_slot, CasinoError::RoundAlreadyClosed);
        require!(amount_lamports >= ctx.accounts.round.min_bet_lamports, CasinoError::InvalidBetAmount);
        require!(
            (nft_multiplier_bps as u64) >= BPS_DENOMINATOR && (nft_multiplier_bps as u64) <= 20_000,
            CasinoError::InvalidNftMultiplier
        );

        let jackpot_cut = amount_lamports
            .checked_mul(ctx.accounts.house.jackpot_bps as u64)
            .ok_or(CasinoError::MathOverflow)?
            / BPS_DENOMINATOR;
        let escrow_cut = amount_lamports.checked_sub(jackpot_cut).ok_or(CasinoError::MathOverflow)?;

        transfer_lamports(
            &ctx.accounts.player.to_account_info(),
            &ctx.accounts.escrow.to_account_info(),
            escrow_cut,
            &ctx.accounts.system_program.to_account_info(),
            &[],
        )?;

        if jackpot_cut > 0 {
            transfer_lamports(
                &ctx.accounts.player.to_account_info(),
                &ctx.accounts.jackpot_vault.to_account_info(),
                jackpot_cut,
                &ctx.accounts.system_program.to_account_info(),
                &[],
            )?;
        }

        let player_bet = &mut ctx.accounts.player_bet;
        if player_bet.player == Pubkey::default() {
            player_bet.player = ctx.accounts.player.key();
            player_bet.round = ctx.accounts.round.key();
            player_bet.bump = ctx.bumps.player_bet;
            player_bet.amount_lamports = 0;
            player_bet.nft_multiplier_bps = nft_multiplier_bps;
            ctx.accounts.round.player_count = ctx
                .accounts
                .round
                .player_count
                .checked_add(1)
                .ok_or(CasinoError::MathOverflow)?;
        }

        player_bet.amount_lamports = player_bet
            .amount_lamports
            .checked_add(amount_lamports)
            .ok_or(CasinoError::MathOverflow)?;
        player_bet.nft_multiplier_bps = nft_multiplier_bps;

        ctx.accounts.round.total_wager_lamports = ctx
            .accounts
            .round
            .total_wager_lamports
            .checked_add(amount_lamports)
            .ok_or(CasinoError::MathOverflow)?;

        Ok(())
    }

    pub fn settle_round<'info>(
        ctx: Context<'_, '_, '_, 'info, SettleRound<'info>>,
        server_seed: [u8; 32],
        nonce: u64,
        jackpot_winner: Option<Pubkey>,
        payouts: Vec<Payout>,
    ) -> Result<()> {
        require!(!ctx.accounts.round.settled, CasinoError::RoundSettled);
        require!(Clock::get()?.slot >= ctx.accounts.round.close_slot, CasinoError::RoundStillOpen);
        require!(payouts.len() <= MAX_PAYOUTS, CasinoError::InvalidPayoutSet);
        require!(
            payouts.len() == ctx.remaining_accounts.len(),
            CasinoError::PayoutAccountsMismatch
        );

        let expected_commit = hashv(&[&server_seed]).to_bytes();
        require!(
            expected_commit == ctx.accounts.round.commit_hash,
            CasinoError::CommitRevealMismatch
        );

        let mut payout_bps_sum: u64 = 0;
        for payout in &payouts {
            payout_bps_sum = payout_bps_sum
                .checked_add(payout.bps as u64)
                .ok_or(CasinoError::MathOverflow)?;
        }
        require!(payout_bps_sum <= BPS_DENOMINATOR, CasinoError::InvalidBps);

        let escrow_balance = **ctx.accounts.escrow.to_account_info().lamports.borrow();
        let mut paid_total: u64 = 0;

        for (idx, payout) in payouts.iter().enumerate() {
            let target = ctx
                .remaining_accounts
                .get(idx)
                .ok_or(CasinoError::PayoutAccountsMismatch)?
                .clone();
            require!(target.key() == payout.player, CasinoError::PayoutAccountsMismatch);

            let payout_lamports = escrow_balance
                .checked_mul(payout.bps as u64)
                .ok_or(CasinoError::MathOverflow)?
                / BPS_DENOMINATOR;

            if payout_lamports > 0 {
                paid_total = paid_total
                    .checked_add(payout_lamports)
                    .ok_or(CasinoError::MathOverflow)?;
                transfer_lamports(
                    &ctx.accounts.escrow.to_account_info(),
                    &target,
                    payout_lamports,
                    &ctx.accounts.system_program.to_account_info(),
                    &[&[
                        b"escrow",
                        ctx.accounts.round.to_account_info().key.as_ref(),
                        &[ctx.accounts.round.escrow_bump],
                    ]],
                )?;
            }
        }

        let treasury_fee = escrow_balance
            .checked_mul(ctx.accounts.house.fee_bps as u64)
            .ok_or(CasinoError::MathOverflow)?
            / BPS_DENOMINATOR;
        let remainder = escrow_balance
            .checked_sub(paid_total)
            .ok_or(CasinoError::MathOverflow)?
            .checked_sub(treasury_fee)
            .ok_or(CasinoError::MathOverflow)?;

        if treasury_fee > 0 {
            transfer_lamports(
                &ctx.accounts.escrow.to_account_info(),
                &ctx.accounts.treasury,
                treasury_fee,
                &ctx.accounts.system_program.to_account_info(),
                &[&[
                    b"escrow",
                    ctx.accounts.round.to_account_info().key.as_ref(),
                    &[ctx.accounts.round.escrow_bump],
                ]],
            )?;
        }

        if remainder > 0 {
            transfer_lamports(
                &ctx.accounts.escrow.to_account_info(),
                &ctx.accounts.treasury,
                remainder,
                &ctx.accounts.system_program.to_account_info(),
                &[&[
                    b"escrow",
                    ctx.accounts.round.to_account_info().key.as_ref(),
                    &[ctx.accounts.round.escrow_bump],
                ]],
            )?;
        }

        let jackpot_trigger_hash = hashv(&[
            &server_seed,
            &nonce.to_le_bytes(),
            &ctx.accounts.round.round_id.to_le_bytes(),
            &ctx.accounts.round.total_wager_lamports.to_le_bytes(),
        ])
        .to_bytes();
        if jackpot_trigger_hash[0] == JACKPOT_TRIGGER_BYTE {
            let jackpot_balance = **ctx.accounts.jackpot_vault.to_account_info().lamports.borrow();
            if jackpot_balance > 0 && jackpot_winner.is_some() {
                let winner_key = jackpot_winner.ok_or(CasinoError::InvalidJackpotWinner)?;
                require!(
                    ctx.accounts.jackpot_winner.key() == winner_key,
                    CasinoError::InvalidJackpotWinner
                );
                transfer_lamports(
                    &ctx.accounts.jackpot_vault.to_account_info(),
                    &ctx.accounts.jackpot_winner.to_account_info(),
                    jackpot_balance,
                    &ctx.accounts.system_program.to_account_info(),
                    &[&[
                        b"jackpot",
                        ctx.accounts.house.to_account_info().key.as_ref(),
                        &[ctx.accounts.house.jackpot_bump],
                    ]],
                )?;
            }
        }

        ctx.accounts.round.settled = true;
        Ok(())
    }
}

fn transfer_lamports<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    amount: u64,
    system_program: &AccountInfo<'a>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    anchor_lang::solana_program::program::invoke_signed(
        &system_instruction::transfer(from.key, to.key, amount),
        &[from.clone(), to.clone(), system_program.clone()],
        signer_seeds,
    )
    .map_err(Into::into)
}

#[derive(Accounts)]
pub struct InitializeHouse<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Treasury wallet for fee/remainder collection.
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + House::LEN,
        seeds = [b"house"],
        bump
    )]
    pub house: Account<'info, House>,
    #[account(
        init,
        payer = authority,
        space = 0,
        seeds = [b"jackpot", house.key().as_ref()],
        bump
    )]
    /// CHECK: System-owned PDA jackpot vault account.
    pub jackpot_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct CreateRound<'info> {
    #[account(mut, has_one = authority)]
    pub house: Account<'info, House>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Round::LEN,
        seeds = [b"round", round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,
    #[account(
        init,
        payer = authority,
        space = 0,
        seeds = [b"escrow", round.key().as_ref()],
        bump
    )]
    /// CHECK: System-owned PDA escrow account.
    pub escrow: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub house: Account<'info, House>,
    #[account(mut, has_one = house)]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        seeds = [b"escrow", round.key().as_ref()],
        bump = round.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"jackpot", house.key().as_ref()],
        bump = house.jackpot_bump
    )]
    pub jackpot_vault: SystemAccount<'info>,
    #[account(
        init_if_needed,
        payer = player,
        space = 8 + PlayerBet::LEN,
        seeds = [b"bet", round.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub player_bet: Account<'info, PlayerBet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleRound<'info> {
    #[account(mut, has_one = authority)]
    pub house: Account<'info, House>,
    pub authority: Signer<'info>,
    #[account(mut, has_one = house)]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        seeds = [b"escrow", round.key().as_ref()],
        bump = round.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"jackpot", house.key().as_ref()],
        bump = house.jackpot_bump
    )]
    pub jackpot_vault: SystemAccount<'info>,
    /// CHECK: Must match configured treasury in house account.
    #[account(mut, address = house.treasury)]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: Jackpot winner account is validated against the jackpot_winner pubkey argument.
    #[account(mut)]
    pub jackpot_winner: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct House {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub jackpot_bps: u16,
    pub bump: u8,
    pub jackpot_bump: u8,
}

impl House {
    pub const LEN: usize = 32 + 32 + 2 + 2 + 1 + 1;
}

#[account]
pub struct Round {
    pub round_id: u64,
    pub house: Pubkey,
    pub commit_hash: [u8; 32],
    pub min_bet_lamports: u64,
    pub close_slot: u64,
    pub total_wager_lamports: u64,
    pub settled: bool,
    pub player_count: u32,
    pub bump: u8,
    pub escrow_bump: u8,
}

impl Round {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 4 + 1 + 1;
}

#[account]
pub struct PlayerBet {
    pub player: Pubkey,
    pub round: Pubkey,
    pub amount_lamports: u64,
    pub nft_multiplier_bps: u16,
    pub bump: u8,
}

impl PlayerBet {
    pub const LEN: usize = 32 + 32 + 8 + 2 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Payout {
    pub player: Pubkey,
    pub bps: u16,
}

#[error_code]
pub enum CasinoError {
    #[msg("BPS values are invalid.")]
    InvalidBps,
    #[msg("Bet amount is below required minimum or invalid.")]
    InvalidBetAmount,
    #[msg("Round is already closed for bets.")]
    RoundAlreadyClosed,
    #[msg("Round is still open and cannot be settled yet.")]
    RoundStillOpen,
    #[msg("Round is already settled.")]
    RoundSettled,
    #[msg("Commit-reveal verification failed.")]
    CommitRevealMismatch,
    #[msg("Math overflow detected.")]
    MathOverflow,
    #[msg("Invalid payout set.")]
    InvalidPayoutSet,
    #[msg("Payout accounts do not match payout payload.")]
    PayoutAccountsMismatch,
    #[msg("NFT multiplier BPS must be between 10000 and 20000.")]
    InvalidNftMultiplier,
    #[msg("Jackpot winner account is invalid or missing.")]
    InvalidJackpotWinner,
}
