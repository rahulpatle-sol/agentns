use anchor_lang::prelude::*;

#[error_code]
pub enum AgentNsError {
    #[msg("Only the admin can do this")]
    Unauthorized,
    #[msg("Only the owner of this name can do this")]
    NotOwner,
    #[msg("Name part must be 1-32 chars of a-z, 0-9 or '-', and cannot start or end with '-'")]
    InvalidNamePart,
    #[msg("Version must look like 1.0 or 1.2.3")]
    InvalidVersion,
    #[msg("Endpoint must start with https:// and be at most 200 chars")]
    InvalidEndpoint,
    #[msg("Metadata URI must be at most 200 chars")]
    InvalidMetadataUri,
    #[msg("name_hash does not match the SHA-256 of the full name")]
    NameHashMismatch,
    #[msg("This name has been revoked")]
    NameRevoked,
    #[msg("New owner must be a different wallet")]
    SameOwner,
    #[msg("Treasury account does not match the registry config")]
    InvalidTreasury,
    // Shared errors (Phase 2 & 3)
    #[msg("Basis points value exceeds maximum allowed")]
    InvalidBps,
    #[msg("Cooldown must be non-negative")]
    InvalidCooldown,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    // Phase 2 errors
    #[msg("Stake is below the minimum required")]
    StakeBelowMinimum,
    #[msg("Signer is not an authorized verifier")]
    NotAVerifier,
    #[msg("Too many verifiers (max 8)")]
    TooManyVerifiers,
    #[msg("Duplicate verifier in list")]
    DuplicateVerifier,
    #[msg("No stake to withdraw")]
    NoStakeToWithdraw,
    #[msg("Unstake was not requested")]
    UnstakeNotRequested,
    #[msg("Unstake already requested")]
    UnstakeAlreadyRequested,
    #[msg("Cooldown period has not finished")]
    CooldownNotFinished,
    #[msg("Stake invariant would be broken")]
    StakeInvariantBroken,
    // Phase 3 errors
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Listing is stale (owner changed)")]
    ListingStale,
    #[msg("Price exceeds maximum allowed")]
    PriceAboveMax,
    #[msg("Unstake is pending, cannot list or buy")]
    UnstakePending,
    #[msg("Cannot buy your own listing")]
    CannotBuyOwnName,
    #[msg("Listing does not match agent record")]
    ListingMismatch,
}
