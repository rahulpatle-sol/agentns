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
        min_stake_lamports: u64,
        slash_bps: u16,
        unstake_cooldown_secs: i64,
        marketplace_fee_bps: u16,
    ) -> Result<()> {
        handle_initialize_config(
            ctx,
            treasury,
            resolver_pubkey,
            registration_fee_lamports,
            min_stake_lamports,
            slash_bps,
            unstake_cooldown_secs,
            marketplace_fee_bps,
        )
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_treasury: Option<Pubkey>,
        new_resolver_pubkey: Option<Pubkey>,
        new_registration_fee_lamports: Option<u64>,
        new_min_stake_lamports: Option<u64>,
        new_slash_bps: Option<u16>,
        new_unstake_cooldown_secs: Option<i64>,
        new_marketplace_fee_bps: Option<u16>,
    ) -> Result<()> {
        handle_update_config(
            ctx,
            new_treasury,
            new_resolver_pubkey,
            new_registration_fee_lamports,
            new_min_stake_lamports,
            new_slash_bps,
            new_unstake_cooldown_secs,
            new_marketplace_fee_bps,
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
        stake_lamports: u64,
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
            stake_lamports,
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

// ===== Phase 2: trust / stake (added in branch phase2-trust) =====
    // New Phase 2 instructions go directly below this line.


    // ===== Phase 3: marketplace (added in branch phase3-marketplace) =====
    // New Phase 3 instructions go directly below this line.


    pub fn list_name(
        ctx: Context<ListName>,
        price_lamports: u64,
    ) -> Result<()> {
        handle_list_name(ctx, price_lamports)
    }

    pub fn cancel_listing(
        ctx: Context<CancelListing>,
    ) -> Result<()> {
        handle_cancel_listing(ctx)
    }

    pub fn buy_name(
        ctx: Context<BuyName>,
        max_price_lamports: u64,
    ) -> Result<()> {
        handle_buy_name(ctx, max_price_lamports)
    }
}
