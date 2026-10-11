use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::AgentNsError;
use crate::events::StakeAdded;
use crate::state::AgentRecord;

pub fn handle_top_up_stake(
    ctx: Context<TopUpStake>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, AgentNsError::StakeBelowMinimum);
    require!(
        ctx.accounts.agent_record.unstake_requested_at == 0,
        AgentNsError::UnstakeAlreadyRequested
    );

    // Transfer from owner to agent_record
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.agent_record.to_account_info(),
            },
        ),
        amount,
    )?;

    // Check rent invariant before adding
    let rent = ctx.accounts.config.rent;
    let rent_exempt = rent.minimum_balance(ctx.accounts.agent_record.try_to_account_info().unwrap().data_len());
    let current_lamports = ctx.accounts.agent_record.lamports;
    let new_lamports = current_lamports.checked_add(amount).ok_or(AnchorError::MathOverflow)?;
    require!(new_lamports >= rent_exempt, AgentNsError::MathOverflow);

    // Add stake to record
    ctx.accounts.agent_record.stake_lamports = ctx.accounts.agent_record.stake_lamports.checked_add(amount).ok_or(AnchorError::MathOverflow);

    emit!(StakeAdded {
        name_hash: ctx.accounts.agent_record.name_hash,
        owner: ctx.accounts.owner.key(),
        amount,
        total_stake: ctx.accounts.agent_record.stake_lamports,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct TopUpStake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [AGENT_SEED, agent_record.name_hash.as_ref()],
        bump = agent_record.bump,
        has_one = owner @ AgentNsError::NotOwner,
        constraint = agent_record.status == AgentStatus::Active @ AgentNsError::NameRevoked
    )]
    pub agent_record: Account<'info, AgentRecord>,

    pub system_program: Program<'info, System>,

    /// Check config for MIN_STAKE etc.
    pub config: Account<'info, RegistryConfig>,
}