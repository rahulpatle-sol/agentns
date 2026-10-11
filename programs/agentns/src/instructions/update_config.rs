use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::AgentNsError;
use crate::events::ConfigUpdated;
use crate::state::RegistryConfig;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ AgentNsError::Unauthorized
    )]
    pub config: Account<'info, RegistryConfig>,
}

/// Admin-only. Pass `None` to keep a value unchanged.
/// Rotating `resolver_pubkey` here is how a compromised resolver key is replaced.
pub fn handle_update_config(
    ctx: Context<UpdateConfig>,
    new_treasury: Option<Pubkey>,
    new_resolver_pubkey: Option<Pubkey>,
    new_registration_fee_lamports: Option<u64>,
    new_min_stake_lamports: Option<u64>,
    new_slash_bps: Option<u16>,
    new_unstake_cooldown_secs: Option<i64>,
    new_marketplace_fee_bps: Option<u16>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    if let Some(v) = new_treasury {
        config.treasury = v;
    }
    if let Some(v) = new_resolver_pubkey {
        config.resolver_pubkey = v;
    }
    if let Some(v) = new_registration_fee_lamports {
        config.registration_fee_lamports = v;
    }
    if let Some(v) = new_min_stake_lamports {
        config.min_stake_lamports = v;
    }
    if let Some(v) = new_slash_bps {
        require!(v <= MAX_BPS, AgentNsError::InvalidBps);
        config.slash_bps = v;
    }
    if let Some(v) = new_unstake_cooldown_secs {
        require!(v >= 0, AgentNsError::InvalidCooldown);
        config.unstake_cooldown_secs = v;
    }
    if let Some(v) = new_marketplace_fee_bps {
        require!(v <= MAX_MARKETPLACE_FEE_BPS, AgentNsError::InvalidBps);
        config.marketplace_fee_bps = v;
    }

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
