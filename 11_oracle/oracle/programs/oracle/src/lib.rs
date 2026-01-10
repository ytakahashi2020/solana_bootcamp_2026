use anchor_lang::prelude::*;
// When Solana platform-tools supports edition2024, uncomment the following:
// use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("CyAAkgrJhEFng3geuL8fHX179ukQjSF8tETkPxnft5rZ");

// SOL/USD Price Feed ID (Mainnet)
// See: https://www.pyth.network/developers/price-feed-ids
pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

// Maximum age for price updates (in seconds)
pub const MAXIMUM_AGE: u64 = 60;

/// Mock price data structure (simulates Pyth price feed)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct Price {
    /// Price value
    pub price: i64,
    /// Confidence interval
    pub conf: u64,
    /// Price exponent (price = price * 10^exponent)
    pub exponent: i32,
    /// Unix timestamp of when this price was computed
    pub publish_time: i64,
}

/// Account to store mock price data
#[account]
pub struct PriceAccount {
    /// The price data
    pub price: Price,
    /// The feed ID (32 bytes)
    pub feed_id: [u8; 32],
    /// Authority that can update the price
    pub authority: Pubkey,
    /// Bump seed
    pub bump: u8,
}

impl PriceAccount {
    pub const SIZE: usize = 8 + // discriminator
        (8 + 8 + 4 + 8) + // Price struct
        32 + // feed_id
        32 + // authority
        1; // bump
}

#[program]
pub mod oracle {
    use super::*;

    /// Initialize a new price feed account (for testing purposes)
    pub fn initialize_price_feed(
        ctx: Context<InitializePriceFeed>,
        feed_id: [u8; 32],
    ) -> Result<()> {
        let price_account = &mut ctx.accounts.price_account;
        price_account.feed_id = feed_id;
        price_account.authority = ctx.accounts.authority.key();
        price_account.bump = ctx.bumps.price_account;
        price_account.price = Price::default();

        msg!("Price feed initialized for feed ID");
        Ok(())
    }

    /// Update the price (only authority can call this - for testing)
    pub fn update_price(
        ctx: Context<UpdatePrice>,
        price: i64,
        conf: u64,
        exponent: i32,
    ) -> Result<()> {
        let price_account = &mut ctx.accounts.price_account;
        let clock = Clock::get()?;

        price_account.price = Price {
            price,
            conf,
            exponent,
            publish_time: clock.unix_timestamp,
        };

        msg!("Price updated: {} * 10^{}", price, exponent);
        msg!("Confidence: {} * 10^{}", conf, exponent);
        msg!("Publish time: {}", clock.unix_timestamp);

        Ok(())
    }

    /// Get the current price from the mock oracle
    pub fn get_price(ctx: Context<GetPrice>) -> Result<()> {
        let price_account = &ctx.accounts.price_account;
        let clock = Clock::get()?;

        // Check if price is not too old
        let age = clock.unix_timestamp - price_account.price.publish_time;
        require!(
            age <= MAXIMUM_AGE as i64,
            OracleError::PriceTooOld
        );

        msg!("Price Feed Data:");
        msg!("Price: {} * 10^{}", price_account.price.price, price_account.price.exponent);
        msg!("Confidence: {} * 10^{}", price_account.price.conf, price_account.price.exponent);
        msg!("Age: {} seconds", age);

        Ok(())
    }

 
}

#[derive(Accounts)]
#[instruction(feed_id: [u8; 32])]
pub struct InitializePriceFeed<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = PriceAccount::SIZE,
        seeds = [b"price_feed", feed_id.as_ref()],
        bump
    )]
    pub price_account: Account<'info, PriceAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        constraint = authority.key() == price_account.authority @ OracleError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub price_account: Account<'info, PriceAccount>,
}

#[derive(Accounts)]
pub struct GetPrice<'info> {
    pub price_account: Account<'info, PriceAccount>,
}


#[error_code]
pub enum OracleError {
    #[msg("Price is too old")]
    PriceTooOld,
    #[msg("Unauthorized")]
    Unauthorized,
}
