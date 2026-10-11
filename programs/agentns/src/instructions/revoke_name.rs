use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::AgentNsError;
use crate::events::NameRevoked;
use crate::state::{AgentRecord, AgentStatus};

#[derive(Accounts)]
pub struct RevokeName<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [AGENT_SEED, agent_record.name_hash.as_ref()],
        bump = agent_record.bump,
        has_one = owner @ AgentNsError::NotOwner,
        constraint = agent_record.status == AgentStatus::Active @ AgentNsError::NameRevoked
    )]
    pub agent_record: Account<'info, AgentRecord>,
}

/// Marks the name Revoked. The account is kept on purpose, so a revoked name
/// stays reserved and nobody else can register it and impersonate the old agent.
pub fn handle_revoke_name(ctx: Context<RevokeName>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let record = &mut ctx.accounts.agent_record;
    record.status = AgentStatus::Revoked;
    record.updated_at = now;

    emit!(NameRevoked {
        name_hash: record.name_hash,
        owner: record.owner,
        timestamp: now,
    });
    Ok(())
}
