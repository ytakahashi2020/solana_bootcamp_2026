use anchor_lang::prelude::*;

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("AJuvFF7KaLxX2CodX1CFrU8xFw8PvenTU6H6CAqB83Xk");

const ANCHOR_DISCRIMINATOR: usize = 8;

#[program]
pub mod crud {
    use super::*;

    pub fn create_memo(ctx: Context<CreateMemo>, memo_id: u64, title: String, message: String) -> Result<()> {
        ctx.accounts.memo.set_inner(Memo {
            memo_id,
            owner: ctx.accounts.user.key(),
            title,
            message,
        });
        Ok(())
    }
    pub fn update_memo(ctx: Context<UpdateMemo>, memo_id: u64, title: String, message: String) -> Result<()> {
        ctx.accounts.memo.set_inner(Memo {
            memo_id,
            owner: ctx.accounts.user.key(),
            title,
            message,
        });
        Ok(())
    }

    pub fn delete_memo(_ctx: Context<DeleteMemo>, memo_id: u64) -> Result<()> {
        msg!("Memo deleted: {}", memo_id);
        Ok(())
    }
}


#[derive(Accounts)]
#[instruction(memo_id: u64)]
pub struct CreateMemo<'info> {
    #[account(
        init, 
        payer = user, 
        space = ANCHOR_DISCRIMINATOR + Memo::INIT_SPACE,
        seeds = [b"memo", memo_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub memo: Account<'info, Memo>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(memo_id: u64, title: String, message: String)]
pub struct UpdateMemo<'info> {
    #[account(mut, 
        seeds = [b"memo", memo_id.to_le_bytes().as_ref(), user.key().as_ref()], 
        bump,
        // 8: memo_id, 32: owner, 4: Stringの先頭の長さ情報
        realloc = ANCHOR_DISCRIMINATOR + 8 +  32 + 4 + title.len()  + 4 + message.len(),
        realloc::payer = user,
        realloc::zero = true,
    )]
    pub memo: Account<'info, Memo>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(memo_id: u64)]
pub struct DeleteMemo<'info> {
    #[account(mut, 
        seeds = [b"memo", memo_id.to_le_bytes().as_ref(), user.key().as_ref()], 
        bump,
        close = user,
    )]
    pub memo: Account<'info, Memo>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[account]
#[derive(InitSpace)]
pub struct Memo {
    pub memo_id: u64,
    pub owner: Pubkey, 
    #[max_len(32)]
    pub title: String,
    #[max_len(280)]
    pub message: String
}
