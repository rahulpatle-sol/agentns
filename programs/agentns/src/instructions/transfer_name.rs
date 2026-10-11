use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::AgentNsError;
use crate::events::NameTransferred;
use crate::state::{AgentRecord, AgentStatus};

#[derive(Accounts)]
pub struct TransferName<'info> {
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

pub fn handle_transfer_name(ctx: Context<TransferName>, new_owner: Pubkey) -> Result<()> {
    let record = &mut ctx.accounts.agent_record;
    require_keys_neq!(new_owner, record.owner, AgentNsError::SameOwner);

    let from = record.owner;
    let now = Clock::get()?.unix_timestamp;
    record.owner = new_owner;
    record.updated_at = now;

    emit!(NameTransferred {
        name_hash: record.name_hash,
        from,
        to: new_owner,
        timestamp: now,
    });
    Ok(())
}
