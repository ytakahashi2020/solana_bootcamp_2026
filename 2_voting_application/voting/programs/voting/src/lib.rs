use anchor_lang::prelude::*;

declare_id!("9ou6NkD8q13aWybmkMWnrE9tHWMYqGgzSpDwcVh9PVub");

const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

#[program]
pub mod voting {
    use super::*;

    pub fn initialize_poll(ctx: Context<InitializePoll>, 
            poll_id: u64, 
            poll_name: String, 
            poll_description: String, 
            poll_voting_start: u64, 
            poll_voting_end: u64
        ) -> Result<()> {
            ctx.accounts.poll_account.set_inner(PollAccount {
                poll_id,
                poll_name,
                poll_description,
                poll_voting_start,
                poll_voting_end,
                candidate_count: 0,
            });
            Ok(())
        }
        pub fn initialize_candidate(ctx: Context<InitializeCandidate>, 
            _poll_id: u64, 
            candidate_id: u64, 
            candidate_name: String
        ) -> Result<()> {
            ctx.accounts.candidate_account.set_inner(CanditateAccount {
                candidate_id,
                candidate_name,
                vote_count: 0,
            });
            ctx.accounts.poll_account.candidate_count += 1;
            Ok(())
        }
        pub fn vote(ctx: Context<Vote>, 
            _poll_id: u64, 
            _candidate_id: u64
        ) -> Result<()> {
            let candidate_account = &mut ctx.accounts.candidate_account;
            let current_time = Clock::get()?.unix_timestamp;

            if current_time < ctx.accounts.poll_account.poll_voting_start as i64
             || current_time > ctx.accounts.poll_account.poll_voting_end as i64 {
                return Err(ErrorCode::PollNotActive.into());
            }
            candidate_account.vote_count += 1;
            Ok(())
        }
}

#[derive(Accounts)]
#[instruction(poll_id: u64)] // 投票IDを引数として受け取る
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed, 
        payer = payer, 
        space = ANCHOR_DISCRIMINATOR_SIZE + PollAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()], // 投票IDをシードとして使用
        bump,
    )]
    pub poll_account: Box<Account<'info, PollAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64, candidate_id: u64)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>, // 支払い者
    #[account(
        mut,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>, // 投票アカウント
    #[account(
        init_if_needed, 
        payer = payer, 
        space = ANCHOR_DISCRIMINATOR_SIZE + CanditateAccount::INIT_SPACE,
        seeds = [b"candidate".as_ref(), poll_id.to_le_bytes().as_ref(), candidate_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub candidate_account: Box<Account<'info, CanditateAccount>>, // 候補者アカウント
    pub system_program: Program<'info, System>, // システムプログラム
}

#[derive(Accounts)]
#[instruction(poll_id: u64, candidate_id: u64)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>, // 投票者
    #[account(
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>, // 投票アカウント
    #[account(
        mut,
        seeds = [b"candidate".as_ref(), poll_id.to_le_bytes().as_ref(), candidate_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub candidate_account: Account<'info, CanditateAccount>, // 候補者アカウント
}


#[account]
#[derive(InitSpace)]
pub struct CanditateAccount {
    pub candidate_id: u64, // 候補者ID
    #[max_len(32)]
    pub candidate_name: String, // 候補者名
    pub vote_count: u64, // 得票数
}

#[account]
#[derive(InitSpace)]
pub struct PollAccount {
    pub poll_id: u64, // 投票ID
    #[max_len(32)]
    pub poll_name: String, // 投票名
    #[max_len(32)]
    pub poll_description: String, // 投票説明
    pub poll_voting_start: u64, // 投票開始時間
    pub poll_voting_end: u64, // 投票終了時間
    pub candidate_count: u64, // 候補者数
}

#[error_code]
pub enum ErrorCode {
    #[msg("Poll is not active")]
    PollNotActive,
}