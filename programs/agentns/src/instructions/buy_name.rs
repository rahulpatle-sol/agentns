use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, LISTING_SEED};
use crate::errors::AgentNsError;
use crate::events::NameSold;
use crate::state::{AgentRecord, AgentStatus, Listing, RegistryConfig};

pub fn handle_buy_name(
    ctx: Context<BuyName>,
    max_price_lamports: u64,
) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let agent_record = &mut ctx.accounts.agent_record;
    let buyer = ctx.accounts.buyer.key();

    // Checks, in this order:
    // 1. record status Active (NameRevoked)
    require!(
        agent_record.status == AgentStatus::Active,
        AgentNsError::NameRevoked
    );
    // 2. listing.seller == agent_record.owner (ListingStale)
    require!(
        listing.seller == agent_record.owner,
        AgentNsError::ListingStale
    );
    // 3. buyer != seller (CannotBuyOwnName)
    require!(
        buyer != listing.seller,
        AgentNsError::CannotBuyOwnName
    );
    // 4. unstake_requested_at == 0 (UnstakePending)
    require!(
        agent_record.unstake_requested_at == 0,
        AgentNsError::UnstakePending
    );
    // 5. listing.price_lamports <= max_price_lamports (PriceAboveMax)
    require!(
        listing.price_lamports <= max_price_lamports,
        AgentNsError::PriceAboveMax
    );

    // Money: compute fee and seller_amount
    let fee = listing.price_lamports * ctx.accounts.config.marketplace_fee_bps as u64 / 10_000;
    let seller_amount = listing.price_lamports.saturating_sub(fee);

    // If fee > 0: System transfer buyer -> treasury
    if fee > 0 {
        **ctx.accounts.treasury.lamports.borrow_mut() += fee;
        **ctx.accounts.buyer.lamports.borrow_mut() -= fee;
    }

    // System transfer buyer -> seller for seller_amount
    if seller_amount > 0 {
        **ctx.accounts.seller.lamports.borrow_mut() += seller_amount;
        **ctx.accounts.buyer.lamports.borrow_mut() -= seller_amount;
    }

    // Then: record.owner = buyer, record.updated_at = now, record.endpoint_verified = false
    agent_record.owner = buyer;
    agent_record.updated_at = Clock::get()?.unix_timestamp;
    agent_record.endpoint_verified = false;

    // The listing account is closed automatically (refunds rent to seller)
    // via close = seller in the account derivation

    emit!(NameSold {
        name_hash: agent_record.name_hash,
        seller: listing.seller,
        buyer,
        price_lamports: listing.price_lamports,
        fee_lamports: fee,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct BuyName<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, RegistryConfig>,

    #[account(
        mut,
        dup,
        address = config.treasury @ AgentNsError::InvalidTreasury
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        mut,
        dup,
        address = listing.seller
    )]
    pub seller: SystemAccount<'info>,

    #[account(mut)]
    pub agent_record: Account<'info, AgentRecord>,

    #[account(
        mut,
        seeds = [LISTING_SEED, agent_record.key().as_ref()],
        bump,
        close = seller,
        constraint = listing.agent_record == agent_record.key()
    )]
    pub listing: Account<'info, Listing>,

    pub system_program: Program<'info, System>,
}