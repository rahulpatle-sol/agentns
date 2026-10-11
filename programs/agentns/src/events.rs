//! Events let the indexer build a full history (explorer-style) for every agent.

use anchor_lang::prelude::*;

#[event]
pub struct ConfigUpdated {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub resolver_pubkey: Pubkey,
    pub registration_fee_lamports: u64,
    pub min_stake_lamports: u64,
    pub slash_bps: u16,
    pub unstake_cooldown_secs: i64,
    pub marketplace_fee_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct AgentRegistered {
    pub name_hash: [u8; 32],
    pub name: String,
    pub owner: Pubkey,
    pub endpoint: String,
    pub agent_pubkey: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EndpointUpdated {
    pub name_hash: [u8; 32],
    pub owner: Pubkey,
    pub endpoint: String,
    pub agent_pubkey: Pubkey,
    pub metadata_uri: String,
    pub timestamp: i64,
}

#[event]
pub struct NameTransferred {
    pub name_hash: [u8; 32],
    pub from: Pubkey,
    pub to: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct NameRevoked {
    pub name_hash: [u8; 32],
    pub owner: Pubkey,
    pub timestamp: i64,
}

// Phase 2 events
#[event]
pub struct StakeAdded {
    pub name_hash: [u8; 32],
    pub owner: Pubkey,
    pub amount: u64,
    pub total_stake: u64,
    pub timestamp: i64,
}

#[event]
pub struct UnstakeRequested {
    pub name_hash: [u8; 32],
    pub owner: Pubkey,
    pub available_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct StakeWithdrawn {
    pub name_hash: [u8; 32],
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct ChallengeReported {
    pub name_hash: [u8; 32],
    pub verifier: Pubkey,
    pub passed: bool,
    pub slashed_lamports: u64,
    pub passes: u32,
    pub fails: u32,
    pub timestamp: i64,
}

#[event]
pub struct EndpointVerified {
    pub name_hash: [u8; 32],
    pub verifier: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VerifiersUpdated {
    pub verifiers: Vec<Pubkey>,
    pub timestamp: i64,
}

// Phase 3 events
#[event]
pub struct NameListed {
    pub name_hash: [u8; 32],
    pub seller: Pubkey,
    pub price_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct ListingCancelled {
    pub name_hash: [u8; 32],
    pub seller: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct NameSold {
    pub name_hash: [u8; 32],
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub price_lamports: u64,
    pub fee_lamports: u64,
    pub timestamp: i64,
}
