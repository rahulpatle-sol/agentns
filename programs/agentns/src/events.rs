//! Events let the indexer build a full history (explorer-style) for every agent.

use anchor_lang::prelude::*;

#[event]
pub struct ConfigUpdated {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub resolver_pubkey: Pubkey,
    pub registration_fee_lamports: u64,
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
