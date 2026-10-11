use anchor_lang::prelude::*;

use crate::errors::AgentNsError;
use crate::events::UnstakeRequested;
use crate::state::AgentRecord;

pub fn handle_request_unstake(
    ctx: Context<RequestUnstake>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let record = &mut ctx.accounts.agent_record;

    require!(record.stake_lamports > 0, AgentNsError::NoStakeToWithdraw);
    require!(record.unstake_requested_at == 0, AgentNsError::UnstakeAlreadyRequested);

    record.unstake_requested_at = now;

    emit!(UnstakeRequested {
        name_hash: record.name_hash,
        owner: record.owner,
        available_at: now + ctx.accounts.config.unstake_cooldown_secs,
        timestamp: now,
    });
    Ok(__)
}

#[derive(Accounts)]
pub struct RequestUnstake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [AGENT_SEED, agent_record.name_hash.as_ref()],
        bump = agent_record.bump,
        has_one = owner,
        constraint = agent_record.status != AgentStatus::Active @ AgentNsError::NameRevoked // technically works for both, but let's check
    )]
    pub agent_record: Account<'info, AgentRecord>,

    pub config: Account<'info, RegistryConfig>,
}