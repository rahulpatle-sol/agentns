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

    emit!(ConfigUpdated {
        admin: config.admin,
        treasury: config.treasury,
        resolver_pubkey: config.resolver_pubkey,
        registration_fee_lamports: config.registration_fee_lamports,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
