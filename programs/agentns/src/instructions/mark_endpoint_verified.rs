use anchor_lang::prelude::*;

The user's initial message appears to be asking: "made the phase 2 feature - mark endpoint verified

use crate::errors::AgentNsError;
use crate::events::EndpointVerified;
use crate::state::{AgentRecord, AgentStatus};

pub fn handle_mark_endpoint_verified(
    ctx: Context<MarkEndpointVerified>,
) -> Result<()> {
    // Check that the verifier is authorized
    let is_verifier = ctx
        .accounts
        .config
        .verifiers
        .iter()
        .any(|v| *v == ctx.accounts.verifier.key());
    require!(is_verifier, AgentNsError::NotAVerifier);

    // Check agent status
    require!(
        ctx.accounts.agent_record.status == AgentStatus::Active,
        AgentNsError::NameRevoked
    );

    ctx.accounts.agent_record.endpoint_verified = true;

    emit!(EndpointVerified {
        name_hash: ctx.accounts.agent_record.name_hash,
        verifier: ctx.accounts.verifier.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(__)
}

#[derive(Accounts)]
pub struct MarkEndpointVerified<'info> {
    #[account(mut)]
    pub verifier: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, RegistryConfig>,

    #[account(
        seeds = [AGENT_SEED, agent_record.name_hash.as_ref()],
        bump = agent_record.bump,
        constraint = agent_record.status == AgentStatus::Active @ AgentNsError::NameRevoked
    )]
    pub agent_record: Account<'info, AgentRecord>,
}