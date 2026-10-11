use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::Protocol;

// Placeholder. After copying these files into your project, run `anchor keys sync`
// so this matches your program keypair.
declare_id!("3CZ5JZgJdxX2wt8UbmyP9kkHPmiMnHhnbsUAXWj7XdnD");

#[program]
pub mod agentns {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        treasury: Pubkey,
        resolver_pubkey: Pubkey,
        registration_fee_lamports: u64,
    ) -> Result<()> {
        handle_initialize_config(ctx, treasury, resolver_pubkey, registration_fee_lamports)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_treasury: Option<Pubkey>,
        new_resolver_pubkey: Option<Pubkey>,
        new_registration_fee_lamports: Option<u64>,
    ) -> Result<()> {
        handle_update_config(
            ctx,
            new_treasury,
            new_resolver_pubkey,
            new_registration_fee_lamports,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn register_name(
        ctx: Context<RegisterName>,
        name_hash: [u8; 32],
        protocol: Protocol,
        agent_id: String,
        capability: String,
        provider: String,
        version: String,
        endpoint: String,
        agent_pubkey: Pubkey,
        metadata_uri: String,
    ) -> Result<()> {
        handle_register_name(
            ctx,
            name_hash,
            protocol,
            agent_id,
            capability,
            provider,
            version,
            endpoint,
            agent_pubkey,
            metadata_uri,
        )
    }

    pub fn update_endpoint(
        ctx: Context<UpdateEndpoint>,
        endpoint: String,
        agent_pubkey: Pubkey,
        metadata_uri: String,
    ) -> Result<()> {
        handle_update_endpoint(ctx, endpoint, agent_pubkey, metadata_uri)
    }

    pub fn transfer_name(ctx: Context<TransferName>, new_owner: Pubkey) -> Result<()> {
        handle_transfer_name(ctx, new_owner)
    }

    pub fn revoke_name(ctx: Context<RevokeName>) -> Result<()> {
        handle_revoke_name(ctx)
    }
}
