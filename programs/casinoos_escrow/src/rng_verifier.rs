// programs/casinoos_escrow/src/rng_verifier.rs
pub fn verify_and_settle_reveal(
    ctx: Context<SettleRound>,
    revealed_seed: [u8; 32],
    expected_hash: [u8; 32],
) -> Result<()> {
    require!(
        hashv(&[&revealed_seed]) == expected_hash,
        CustomError::InvalidReveal
    );
    // On-chain deterministic RNG calculation
    let outcome = generate_fair_outcome(&revealed_seed, ctx.accounts.round.commitment);
    // ... payout logic
}