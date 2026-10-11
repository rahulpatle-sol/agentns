use anchor_lang::prelude::*;

use crate::constants::*;

/// One per deployment. PDA: ["config"].
#[account]
#[derive(InitSpace)]
pub struct RegistryConfig {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    /// Public key clients use to verify signatures from the resolver service.
    pub resolver_pubkey: Pubkey,
    pub registration_fee_lamports: u64,
    /// Minimum stake (lamports) required to register a name (Phase 2).
    pub min_stake_lamports: u64,
    /// Share of stake (basis points) taken on a failed challenge (Phase 2).
    pub slash_bps: u16,
    /// Seconds to wait before stake can be withdrawn after requesting unstake (Phase 2).
    pub unstake_cooldown_secs: i64,
    /// Fee (basis points) on every marketplace sale (Phase 3).
    pub marketplace_fee_bps: u16,
    /// Wallets allowed to report challenges (Phase 2).
    #[max_len(MAX_VERIFIERS)]
    pub verifiers: Vec<Pubkey>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Protocol {
    A2a,
    Mcp,
    Acp,
}

impl Protocol {
    pub fn as_str(&self) -> &'static str {
        match self {
            Protocol::A2a => "a2a",
            Protocol::Mcp => "mcp",
            Protocol::Acp => "acp",
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum AgentStatus {
    Active,
    Revoked,
}

/// One per registered agent name. PDA: ["agent", sha256(full_name)].
#[account]
#[derive(InitSpace)]
pub struct AgentRecord {
    pub owner: Pubkey,
    pub name_hash: [u8; 32],
    pub protocol: Protocol,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    #[max_len(MAX_PART_LEN)]
    pub agent_id: String,
    #[max_len(MAX_PART_LEN)]
    pub capability: String,
    #[max_len(MAX_PART_LEN)]
    pub provider: String,
    #[max_len(MAX_VERSION_LEN)]
    pub version: String,
    #[max_len(MAX_ENDPOINT_LEN)]
    pub endpoint: String,
    /// The agent's own public key (used later for endpoint-ownership proofs).
    pub agent_pubkey: Pubkey,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub status: AgentStatus,
    pub registered_at: i64,
    pub updated_at: i64,
    // Phase 2 (trust/stake) fields.
    pub stake_lamports: u64,
    pub passes: u32,
    pub fails: u32,
    /// Timestamp when unstake was requested; 0 means no unstake pending (Phase 2).
    pub unstake_requested_at: i64,
    /// Whether the endpoint has been verified by a verifier (Phase 2).
    pub endpoint_verified: bool,
    pub bump: u8,
}
