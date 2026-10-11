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
}
