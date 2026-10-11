use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::AgentNsError;
use crate::events::ConfigUpdated;
use crate::state::RegistryConfig;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + RegistryConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, RegistryConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_config(
    ctx: Context<InitializeConfig>,
    treasury: Pubkey,
    resolver_pubkey: Pubkey,
    registration_fee_lamports: u64,
    min_stake_lamports: u64,
    slash_bps: u16,
    unstake_cooldown_secs: i64,
    marketplace_fee_bps: u16,
) -> Result<()> {
    // Validate basis points
    require!(slash_bps <= MAX_BPS, AgentNsError::InvalidBps);
    require!(marketplace_fee_bps <= MAX_MARKETPLACE_FEE_BPS, AgentNsError::InvalidBps);
    // Validate cooldown
    require!(unstake_cooldown_secs >= 0, AgentNsError::InvalidCooldown);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.treasury = treasury;
    config.resolver_pubkey = resolver_pubkey;
    config.registration_fee_lamports = registration_fee_lamports;
    config.min_stake_lamports = min_stake_lamports;
    config.slash_bps = slash_bps;
    config.unstake_cooldown_secs = unstake_cooldown_secs;
    config.marketplace_fee_bps = marketplace_fee_bps;
    config.verifiers = Vec::new();
    config.bump = ctx.bumps.config;

    emit!(ConfigUpdated {
        admin: config.admin,
        treasury: config.treasury,
        resolver_pubkey: config.resolver_pubkey,
        registration_fee_lamports: config.registration_fee_lamports,
        min_stake_lamports: config.min_stake_lamports,
        slash_bps: config.slash_bps,
        unstake_cooldown_secs: config.unstake_cooldown_secs,
        marketplace_fee_bps: config.marketplace_fee_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
