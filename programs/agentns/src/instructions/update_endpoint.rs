use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::AgentNsError;
use crate::events::EndpointUpdated;
use crate::state::{AgentRecord, AgentStatus};
use crate::utils::*;

#[derive(Accounts)]
pub struct UpdateEndpoint<'info> {
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

pub fn handle_update_endpoint(
    ctx: Context<UpdateEndpoint>,
    endpoint: String,
    agent_pubkey: Pubkey,
    metadata_uri: String,
) -> Result<()> {
    validate_endpoint(&endpoint)?;
    validate_metadata_uri(&metadata_uri)?;

    let now = Clock::get()?.unix_timestamp;
    let record = &mut ctx.accounts.agent_record;
    record.endpoint = endpoint.clone();
    record.agent_pubkey = agent_pubkey;
    record.metadata_uri = metadata_uri.clone();
    record.updated_at = now;

    emit!(EndpointUpdated {
        name_hash: record.name_hash,
        owner: record.owner,
        endpoint,
        agent_pubkey,
        metadata_uri,
        timestamp: now,
    });
    Ok(())
}
