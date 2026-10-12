use anchor_lang::prelude::*;

use crate::constants::{LISTING_SEED, AGENT_SEED};
use crate::errors::AgentNsError;
use crate::events::ListingCancelled;
use crate::state::{AgentRecord, Listing};

pub fn handle_cancel_listing(
    ctx: Context<CancelListing>,
) -> Result<()> {
    emit!(ListingCancelled {
        name_hash: ctx.accounts.agent_record.name_hash,
        seller: ctx.accounts.listing.seller,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [LISTING_SEED, agent_record.key().as_ref()],
        bump = listing.bump,
        has_one = seller @ AgentNsError::NotOwner,
        constraint = listing.agent_record == agent_record.key() @ AgentNsError::ListingMismatch,
        close = seller
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        seeds = [AGENT_SEED, agent_record.name_hash.as_ref()],
        bump = agent_record.bump,
    )]
    pub agent_record: Account<'info, AgentRecord>,

    pub system_program: Program<'info, System>,
}