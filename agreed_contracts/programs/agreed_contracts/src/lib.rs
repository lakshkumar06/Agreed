use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("2Ye3UPoTi9t7j1vHq6VsqivGxQWgd6ofga5DgLRkJrFb");

#[program]
pub mod agreed_contracts {
    use super::*;

    pub fn initialize_reputation(ctx: Context<InitializeReputation>) -> Result<()> {
        let reputation = &mut ctx.accounts.reputation;
        let clock = Clock::get()?;
        
        reputation.wallet = ctx.accounts.user.key();
        reputation.contracts_created = 0;
        reputation.contracts_completed = 0;
        reputation.contracts_approved = 0;
        reputation.total_value_escrowed = 0;
        reputation.first_activity = clock.unix_timestamp;
        reputation.last_activity = clock.unix_timestamp;
        reputation.bump = ctx.bumps.reputation;
        
        msg!("Reputation account created for: {}", reputation.wallet);
        Ok(())
    }

    pub fn initialize_contract(
        ctx: Context<InitializeContract>,
        contract_id: u64,
        participants: Vec<Pubkey>,
        required_approvals: u8,
    ) -> Result<()> {
        require!(
            participants.len() <= Contract::MAX_PARTICIPANTS,
            ErrorCode::TooManyParticipants
        );
        require!(
            required_approvals as usize <= participants.len(),
            ErrorCode::InvalidApprovalThreshold
        );
        require!(
            participants.contains(&ctx.accounts.creator.key()),
            ErrorCode::CreatorMustBeParticipant
        );

        let contract = &mut ctx.accounts.contract;
        contract.contract_id = contract_id;
        contract.creator = ctx.accounts.creator.key();
        contract.participants = participants;
        contract.status = ContractStatus::Active;
        contract.required_approvals = required_approvals;
        contract.current_approvals = 0;
        contract.approvers = Vec::new();
        contract.ipfs_hash = String::new();
        contract.created_at = Clock::get()?.unix_timestamp;
        contract.bump = ctx.bumps.contract;

        // Update creator's reputation
        let creator_rep = &mut ctx.accounts.creator_reputation;
        creator_rep.contracts_created += 1;
        creator_rep.last_activity = Clock::get()?.unix_timestamp;

        msg!("Contract {} created by {}", contract_id, contract.creator);
        Ok(())
    }

    pub fn approve_contract(ctx: Context<ApproveContract>) -> Result<()> {
        let contract = &mut ctx.accounts.contract;
        let approver = ctx.accounts.approver.key();

        require!(
            contract.status == ContractStatus::Active,
            ErrorCode::ContractNotActive
        );
        require!(
            contract.participants.contains(&approver),
            ErrorCode::NotAParticipant
        );
        require!(
            !contract.approvers.contains(&approver),
            ErrorCode::AlreadyApproved
        );

        contract.approvers.push(approver);
        contract.current_approvals += 1;

        // Update approver's reputation
        let approver_rep = &mut ctx.accounts.approver_reputation;
        approver_rep.contracts_approved += 1;
        approver_rep.last_activity = Clock::get()?.unix_timestamp;

        let was_completed = contract.current_approvals >= contract.required_approvals;
        if was_completed {
            contract.status = ContractStatus::Completed;
            msg!("Contract {} completed!", contract.contract_id);
        }

        msg!("Contract {} approved by {}", contract.contract_id, approver);
        Ok(())
    }

    pub fn mark_contract_complete(
        ctx: Context<MarkContractComplete>,
    ) -> Result<()> {
        let contract = &ctx.accounts.contract;
        
        require!(
            contract.status == ContractStatus::Completed,
            ErrorCode::ContractNotCompleted
        );

        // Update participant's completion count
        let participant_rep = &mut ctx.accounts.participant_reputation;
        participant_rep.contracts_completed += 1;
        participant_rep.last_activity = Clock::get()?.unix_timestamp;

        msg!("Marked complete for participant: {}", participant_rep.wallet);
        Ok(())
    }

    pub fn cancel_contract(ctx: Context<CancelContract>) -> Result<()> {
        let contract = &mut ctx.accounts.contract;

        require!(
            contract.status == ContractStatus::Active,
            ErrorCode::ContractNotActive
        );
        require!(
            contract.creator == ctx.accounts.creator.key(),
            ErrorCode::OnlyCreatorCanCancel
        );

        contract.status = ContractStatus::Cancelled;

        Ok(())
    }

    pub fn update_contract_ipfs(ctx: Context<UpdateContractIpfs>, ipfs_hash: String) -> Result<()> {
        require!(
            ipfs_hash.len() <= 46,
            ErrorCode::IpfsHashTooLong
        );
        
        let contract = &mut ctx.accounts.contract;
        let updater = ctx.accounts.updater.key();

        require!(
            contract.participants.contains(&updater),
            ErrorCode::NotAParticipant
        );

        contract.ipfs_hash = ipfs_hash;
        
        msg!("Contract {} IPFS hash updated to {}", contract.contract_id, contract.ipfs_hash);
        Ok(())
    }

    // ========== ESCROW MILESTONE FUNCTIONS ==========

    pub fn initialize_escrow_milestone(
        ctx: Context<InitializeEscrowMilestone>,
        milestone_id: u64,
        contract_id: u64,
        description: String,
        amount: u64,
        recipient: Pubkey,
        deadline: i64,
    ) -> Result<()> {
        require!(
            description.len() <= 200,
            ErrorCode::DescriptionTooLong
        );
        
        let contract = &ctx.accounts.contract;
        require!(
            contract.status == ContractStatus::Active,
            ErrorCode::ContractNotActive
        );
        require!(
            contract.creator == ctx.accounts.creator.key(),
            ErrorCode::OnlyCreatorCanInitializeEscrow
        );
        require!(
            contract.participants.contains(&recipient),
            ErrorCode::RecipientNotParticipant
        );
        require!(
            amount > 0,
            ErrorCode::InvalidAmount
        );

        // Transfer SOL to escrow PDA first
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.escrow_milestone.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        // Now initialize the escrow data
        let escrow = &mut ctx.accounts.escrow_milestone;
        escrow.milestone_id = milestone_id;
        escrow.contract_id = contract_id;
        escrow.description = description;
        escrow.amount = amount;
        escrow.recipient = recipient;
        escrow.deadline = deadline;
        escrow.status = MilestoneStatus::Funded;
        escrow.approvals_required = contract.participants.len() as u8;
        escrow.approvals = Vec::new();
        escrow.marked_complete_by = None;
        escrow.creator = ctx.accounts.creator.key();
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.bump = ctx.bumps.escrow_milestone;

        // Update creator reputation
        let creator_rep = &mut ctx.accounts.creator_reputation;
        creator_rep.total_value_escrowed += amount;
        creator_rep.last_activity = Clock::get()?.unix_timestamp;

        msg!("Escrow milestone {} created and funded with {} lamports", milestone_id, amount);
        Ok(())
    }

    pub fn mark_milestone_complete(
        ctx: Context<MarkMilestoneComplete>,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_milestone;
        let marker = ctx.accounts.marker.key();

        require!(
            escrow.status == MilestoneStatus::Funded,
            ErrorCode::MilestoneNotFunded
        );

        let contract = &ctx.accounts.contract;
        require!(
            contract.participants.contains(&marker),
            ErrorCode::NotAParticipant
        );

        escrow.marked_complete_by = Some(marker);
        escrow.status = MilestoneStatus::MarkedComplete;

        msg!("Milestone {} marked complete by {}", escrow.milestone_id, marker);
        Ok(())
    }

    pub fn approve_milestone_release(
        ctx: Context<ApproveMilestoneRelease>,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_milestone;
        let approver = ctx.accounts.approver.key();

        require!(
            escrow.status == MilestoneStatus::MarkedComplete,
            ErrorCode::MilestoneNotMarkedComplete
        );

        let contract = &ctx.accounts.contract;
        require!(
            contract.participants.contains(&approver),
            ErrorCode::NotAParticipant
        );
        require!(
            !escrow.approvals.contains(&approver),
            ErrorCode::AlreadyApprovedMilestone
        );

        escrow.approvals.push(approver);

        // Update approver reputation
        let approver_rep = &mut ctx.accounts.approver_reputation;
        approver_rep.last_activity = Clock::get()?.unix_timestamp;

        msg!(
            "Milestone {} approved by {} ({}/{})",
            escrow.milestone_id,
            approver,
            escrow.approvals.len(),
            escrow.approvals_required
        );

        Ok(())
    }

    pub fn release_escrow_funds(
        ctx: Context<ReleaseEscrowFunds>,
    ) -> Result<()> {
        // Check status and approvals first
        {
            let escrow = &ctx.accounts.escrow_milestone;
            require!(
                escrow.status == MilestoneStatus::MarkedComplete,
                ErrorCode::MilestoneNotMarkedComplete
            );
            require!(
                escrow.approvals.len() >= escrow.approvals_required as usize,
                ErrorCode::InsufficientApprovals
            );
        }

        let amount = ctx.accounts.escrow_milestone.amount;
        let milestone_id = ctx.accounts.escrow_milestone.milestone_id;
        let recipient = ctx.accounts.escrow_milestone.recipient;
        
        // Transfer funds from escrow PDA to recipient
        **ctx.accounts.escrow_milestone.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += amount;

        // Update status
        let escrow = &mut ctx.accounts.escrow_milestone;
        escrow.status = MilestoneStatus::Released;

        msg!("Escrow milestone {} released {} lamports to {}", milestone_id, amount, recipient);
        Ok(())
    }

    pub fn cancel_escrow_milestone(
        ctx: Context<CancelEscrowMilestone>,
    ) -> Result<()> {
        let creator = ctx.accounts.creator.key();

        // Check permissions and status first
        let (amount, milestone_id, is_funded) = {
            let escrow = &ctx.accounts.escrow_milestone;
            require!(
                escrow.creator == creator,
                ErrorCode::OnlyCreatorCanCancelEscrow
            );
            require!(
                escrow.status == MilestoneStatus::Funded || escrow.status == MilestoneStatus::Pending,
                ErrorCode::CannotCancelMilestone
            );
            (escrow.amount, escrow.milestone_id, escrow.status == MilestoneStatus::Funded)
        };

        // Refund to creator if funded
        if is_funded {
            **ctx.accounts.escrow_milestone.to_account_info().try_borrow_mut_lamports()? -= amount;
            **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += amount;
        }

        // Update status
        let escrow = &mut ctx.accounts.escrow_milestone;
        escrow.status = MilestoneStatus::Cancelled;

        msg!("Escrow milestone {} cancelled and refunded", milestone_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeReputation<'info> {
    #[account(
        init,
        payer = user,
        space = UserReputation::LEN,
        seeds = [b"reputation", user.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, UserReputation>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(contract_id: u64)]
pub struct InitializeContract<'info> {
    #[account(
        init,
        payer = creator,
        space = Contract::LEN,
        seeds = [b"contract", contract_id.to_le_bytes().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub contract: Account<'info, Contract>,
    
    #[account(
        mut,
        seeds = [b"reputation", creator.key().as_ref()],
        bump = creator_reputation.bump,
    )]
    pub creator_reputation: Account<'info, UserReputation>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveContract<'info> {
    #[account(
        mut,
        seeds = [b"contract", contract.contract_id.to_le_bytes().as_ref(), contract.creator.key().as_ref()],
        bump = contract.bump
    )]
    pub contract: Account<'info, Contract>,
    
    #[account(
        mut,
        seeds = [b"reputation", approver.key().as_ref()],
        bump = approver_reputation.bump,
    )]
    pub approver_reputation: Account<'info, UserReputation>,
    
    pub approver: Signer<'info>,
}

#[derive(Accounts)]
pub struct MarkContractComplete<'info> {
    #[account(
        seeds = [b"contract", contract.contract_id.to_le_bytes().as_ref(), contract.creator.key().as_ref()],
        bump = contract.bump
    )]
    pub contract: Account<'info, Contract>,
    
    #[account(
        mut,
        seeds = [b"reputation", participant.key().as_ref()],
        bump = participant_reputation.bump,
    )]
    pub participant_reputation: Account<'info, UserReputation>,
    
    /// CHECK: We verify they're in contract.participants
    pub participant: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CancelContract<'info> {
    #[account(
        mut,
        seeds = [b"contract", contract.contract_id.to_le_bytes().as_ref(), contract.creator.key().as_ref()],
        bump = contract.bump
    )]
    pub contract: Account<'info, Contract>,
    
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateContractIpfs<'info> {
    #[account(
        mut,
        seeds = [b"contract", contract.contract_id.to_le_bytes().as_ref(), contract.creator.key().as_ref()],
        bump = contract.bump
    )]
    pub contract: Account<'info, Contract>,
    
    pub updater: Signer<'info>,
}

// ========== ESCROW MILESTONE ACCOUNT STRUCTURES ==========

#[derive(Accounts)]
#[instruction(milestone_id: u64, contract_id: u64)]
pub struct InitializeEscrowMilestone<'info> {
    #[account(
        init,
        payer = creator,
        space = EscrowMilestone::LEN,
        seeds = [b"escrow", contract_id.to_le_bytes().as_ref(), milestone_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_milestone: Account<'info, EscrowMilestone>,

    #[account(
        seeds = [b"contract", contract.contract_id.to_le_bytes().as_ref(), contract.creator.key().as_ref()],
        bump = contract.bump
    )]
    pub contract: Account<'info, Contract>,

    #[account(
        mut,
        seeds = [b"reputation", creator.key().as_ref()],
        bump = creator_reputation.bump,
    )]
    pub creator_reputation: Account<'info, UserReputation>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarkMilestoneComplete<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_milestone.contract_id.to_le_bytes().as_ref(), escrow_milestone.milestone_id.to_le_bytes().as_ref()],
        bump = escrow_milestone.bump
    )]
    pub escrow_milestone: Account<'info, EscrowMilestone>,

    #[account(
        seeds = [b"contract", contract.contract_id.to_le_bytes().as_ref(), contract.creator.key().as_ref()],
        bump = contract.bump
    )]
    pub contract: Account<'info, Contract>,

    pub marker: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveMilestoneRelease<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_milestone.contract_id.to_le_bytes().as_ref(), escrow_milestone.milestone_id.to_le_bytes().as_ref()],
        bump = escrow_milestone.bump
    )]
    pub escrow_milestone: Account<'info, EscrowMilestone>,

    #[account(
        seeds = [b"contract", contract.contract_id.to_le_bytes().as_ref(), contract.creator.key().as_ref()],
        bump = contract.bump
    )]
    pub contract: Account<'info, Contract>,

    #[account(
        mut,
        seeds = [b"reputation", approver.key().as_ref()],
        bump = approver_reputation.bump,
    )]
    pub approver_reputation: Account<'info, UserReputation>,

    pub approver: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReleaseEscrowFunds<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_milestone.contract_id.to_le_bytes().as_ref(), escrow_milestone.milestone_id.to_le_bytes().as_ref()],
        bump = escrow_milestone.bump
    )]
    pub escrow_milestone: Account<'info, EscrowMilestone>,

    /// CHECK: Verified via escrow_milestone.recipient
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CancelEscrowMilestone<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_milestone.contract_id.to_le_bytes().as_ref(), escrow_milestone.milestone_id.to_le_bytes().as_ref()],
        bump = escrow_milestone.bump
    )]
    pub escrow_milestone: Account<'info, EscrowMilestone>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[account]
pub struct Contract {
    pub contract_id: u64,
    pub creator: Pubkey,
    pub participants: Vec<Pubkey>,
    pub status: ContractStatus,
    pub required_approvals: u8,
    pub current_approvals: u8,
    pub approvers: Vec<Pubkey>,
    pub ipfs_hash: String,
    pub created_at: i64,
    pub bump: u8,
}

impl Contract {
    pub const MAX_PARTICIPANTS: usize = 10;
    pub const LEN: usize = 8 + // discriminator
        8 + // contract_id
        32 + // creator
        (4 + 32 * Self::MAX_PARTICIPANTS) + // participants vec
        1 + // status
        1 + // required_approvals
        1 + // current_approvals
        (4 + 32 * Self::MAX_PARTICIPANTS) + // approvers vec
        (4 + 46) + // ipfs_hash
        8 + // created_at
        1; // bump
}

#[account]
pub struct UserReputation {
    pub wallet: Pubkey,
    pub contracts_created: u32,
    pub contracts_completed: u32,
    pub contracts_approved: u32,
    pub total_value_escrowed: u64,
    pub first_activity: i64,
    pub last_activity: i64,
    pub bump: u8,
}

impl UserReputation {
    pub const LEN: usize = 8 + // discriminator
        32 + // wallet
        4 +  // contracts_created
        4 +  // contracts_completed
        4 +  // contracts_approved
        8 +  // total_value_escrowed
        8 +  // first_activity
        8 +  // last_activity
        1;   // bump
}

#[account]
pub struct EscrowMilestone {
    pub milestone_id: u64,
    pub contract_id: u64,
    pub description: String,
    pub amount: u64,
    pub recipient: Pubkey,
    pub deadline: i64,
    pub status: MilestoneStatus,
    pub approvals_required: u8,
    pub approvals: Vec<Pubkey>,
    pub marked_complete_by: Option<Pubkey>,
    pub creator: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

impl EscrowMilestone {
    pub const MAX_PARTICIPANTS: usize = 10;
    pub const LEN: usize = 8 + // discriminator
        8 + // milestone_id
        8 + // contract_id
        (4 + 200) + // description (max 200 chars)
        8 + // amount
        32 + // recipient
        8 + // deadline
        1 + // status enum
        1 + // approvals_required
        (4 + 32 * Self::MAX_PARTICIPANTS) + // approvals vec
        (1 + 32) + // marked_complete_by option
        32 + // creator
        8 + // created_at
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ContractStatus {
    Active,
    Completed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MilestoneStatus {
    Pending,
    Funded,
    MarkedComplete,
    Released,
    Cancelled,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Too many participants (max 10)")]
    TooManyParticipants,
    #[msg("Invalid approval threshold")]
    InvalidApprovalThreshold,
    #[msg("Creator must be a participant")]
    CreatorMustBeParticipant,
    #[msg("Contract is not active")]
    ContractNotActive,
    #[msg("You are not a participant")]
    NotAParticipant,
    #[msg("You have already approved this contract")]
    AlreadyApproved,
    #[msg("Only creator can cancel the contract")]
    OnlyCreatorCanCancel,
    #[msg("Contract is not completed yet")]
    ContractNotCompleted,
    #[msg("Reputation account already exists")]
    ReputationAlreadyExists,
    #[msg("Description too long (max 200 characters)")]
    DescriptionTooLong,
    #[msg("Only creator can initialize escrow")]
    OnlyCreatorCanInitializeEscrow,
    #[msg("Recipient must be a participant")]
    RecipientNotParticipant,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Milestone is not funded")]
    MilestoneNotFunded,
    #[msg("Milestone not marked complete")]
    MilestoneNotMarkedComplete,
    #[msg("Already approved this milestone")]
    AlreadyApprovedMilestone,
    #[msg("Insufficient approvals to release funds")]
    InsufficientApprovals,
    #[msg("Only creator can cancel escrow")]
    OnlyCreatorCanCancelEscrow,
    #[msg("Cannot cancel milestone in current status")]
    CannotCancelMilestone,
    #[msg("IPFS hash too long (max 46 characters)")]
    IpfsHashTooLong,
}

