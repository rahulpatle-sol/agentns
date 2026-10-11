use anchor_lang::prelude::*;

use crate::constants::{LISTING_SEED, AGENT_SEED};
use crate::errors::AgentNsError;
use crate::events::NameListed;
use crate::state::{AgentRecord, AgentStatus, Listing};

pub fn handle_list_name(
    ctx: Context<ListName>,
    price_lamports: u64,
) -> Result<()> {
    require!(price_lamports > 0, AgentNsError::InvalidPrice);
    require!(
        ctx.accounts.agent_record.unstake_requested_at == 0,
        AgentNsError::UnstakePending
    );
    require!(
        ctx.accounts.agent_record.status == AgentStatus::Active,
        AgentNsError::NameRevoked
    );

    let listing_bump = ctx.bumps.listing;

    // Check stale: listing.seller must equal agent_record.owner
    require!(
        ctx.accounts.listing.seller == ctx.accounts.agent_record.owner,
        AgentNsError::ListingStale
    );

    ctx.accounts.listing.seller = ctx.accounts.agent_record.owner.clone();
    ctx.accounts.listing.price_lamports = price_lamports;
    ctx.accounts.listing.created_at = Clock::get()?.unix_timestamp;
    ctx.accounts.listing.bump = listing_bump;

    emit!(NameListed {
        name_hash: ctx.accounts.agent_record.name_hash,
        seller: ctx.accounts.agent_record.owner,
        price_lamports,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ListName<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [AGENT_SEED, agent_record.name_hash.as_ref()],
        bump = agent_record.bump,
        has_one = owner @ AgentNsError::NotOwner,
        constraint = agent_record.status == AgentStatus::Active @ AgentNsError::NameRevoked
    )]
    pub agent_record: Account<'info, AgentRecord>,

    #[account(
        init,
        payer = owner,
        space = 8 + Listing::INIT_SPACE,
        seeds = [LISTING_SEED, agent_record.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,

    pub system_program: Program<'info, System>,
}