use anchor_lang::prelude::*;

use crate::constants::*;
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
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.treasury = treasury;
    config.resolver_pubkey = resolver_pubkey;
    config.registration_fee_lamports = registration_fee_lamports;
    config.bump = ctx.bumps.config;

    emit!(ConfigUpdated {
        admin: config.admin,
        treasury: config.treasury,
        resolver_pubkey: config.resolver_pubkey,
        registration_fee_lamports: config.registration_fee_lamports,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
