use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::AgentNsError;
use crate::events::AgentRegistered;
use crate::state::{AgentRecord, AgentStatus, Protocol, RegistryConfig};
use crate::utils::*;

#[derive(Accounts)]
#[instruction(
    name_hash: [u8; 32],
    protocol: Protocol,
    agent_id: String,
    capability: String,
    provider: String,
    version: String,
    endpoint: String,
    agent_pubkey: Pubkey,
    metadata_uri: String
)]
pub struct RegisterName<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, RegistryConfig>,

    /// Registration fee goes here. `dup` because the owner may also be the treasury on devnet.
    #[account(mut, dup, address = config.treasury @ AgentNsError::InvalidTreasury)]
    pub treasury: SystemAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + AgentRecord::INIT_SPACE,
        seeds = [AGENT_SEED, name_hash.as_ref()],
        bump
    )]
    pub agent_record: Account<'info, AgentRecord>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_register_name(
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
    validate_part(&agent_id)?;
    validate_part(&capability)?;
    validate_part(&provider)?;
    validate_version(&version)?;
    validate_endpoint(&endpoint)?;
    validate_metadata_uri(&metadata_uri)?;

    // The PDA was derived from the client-supplied hash, so re-compute it here.
    // This is what guarantees one account per unique full name.
    let name = build_name(protocol, &agent_id, &capability, &provider, &version);
    require!(hash_name(&name) == name_hash, AgentNsError::NameHashMismatch);

    let fee = ctx.accounts.config.registration_fee_lamports;
    if fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    let now = Clock::get()?.unix_timestamp;
    let record = &mut ctx.accounts.agent_record;
    record.owner = ctx.accounts.owner.key();
    record.name_hash = name_hash;
    record.protocol = protocol;
    record.name = name.clone();
    record.agent_id = agent_id;
    record.capability = capability;
    record.provider = provider;
    record.version = version;
    record.endpoint = endpoint.clone();
    record.agent_pubkey = agent_pubkey;
    record.metadata_uri = metadata_uri;
    record.status = AgentStatus::Active;
    record.registered_at = now;
    record.updated_at = now;
    record.stake_lamports = 0;
    record.passes = 0;
    record.fails = 0;
    record.bump = ctx.bumps.agent_record;

    emit!(AgentRegistered {
        name_hash,
        name,
        owner: record.owner,
        endpoint,
        agent_pubkey,
        timestamp: now,
    });
    Ok(())
}
