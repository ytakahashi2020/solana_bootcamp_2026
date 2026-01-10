use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("CyAAkgrJhEFng3geuL8fHX179ukQjSF8tETkPxnft5rZ");

// Price Feed IDs from Pyth (Hermes)
// See: https://www.pyth.network/developers/price-feed-ids
pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
pub const USDC_USD_FEED_ID: &str = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

// Maximum age for price updates (in seconds)
pub const MAXIMUM_AGE: u64 = 60;

#[program]
pub mod oracle {
    use super::*;

    /// Get SOL/USD price from Pyth oracle
    pub fn get_sol_price(ctx: Context<GetPrice>) -> Result<()> {
        let price_update = &ctx.accounts.price_update;
        let clock = Clock::get()?;

        let sol_feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
        let price = price_update.get_price_no_older_than(&clock, MAXIMUM_AGE, &sol_feed_id)?;

        msg!("SOL/USD Price Feed:");
        msg!("Price: {} * 10^{}", price.price, price.exponent);
        msg!("Confidence: {} * 10^{}", price.conf, price.exponent);
        msg!("Publish time: {}", price.publish_time);

        Ok(())
    }

    /// Get USDC/USD price from Pyth oracle
    pub fn get_usdc_price(ctx: Context<GetPrice>) -> Result<()> {
        let price_update = &ctx.accounts.price_update;
        let clock = Clock::get()?;

        let usdc_feed_id = get_feed_id_from_hex(USDC_USD_FEED_ID)?;
        let price = price_update.get_price_no_older_than(&clock, MAXIMUM_AGE, &usdc_feed_id)?;

        msg!("USDC/USD Price Feed:");
        msg!("Price: {} * 10^{}", price.price, price.exponent);
        msg!("Confidence: {} * 10^{}", price.conf, price.exponent);
        msg!("Publish time: {}", price.publish_time);

        Ok(())
    }

    /// Get price for any feed ID
    pub fn get_price_by_feed_id(ctx: Context<GetPrice>, feed_id_hex: String) -> Result<()> {
        let price_update = &ctx.accounts.price_update;
        let clock = Clock::get()?;

        let feed_id = get_feed_id_from_hex(&feed_id_hex)?;
        let price = price_update.get_price_no_older_than(&clock, MAXIMUM_AGE, &feed_id)?;

        msg!("Price Feed Data:");
        msg!("Price: {} * 10^{}", price.price, price.exponent);
        msg!("Confidence: {} * 10^{}", price.conf, price.exponent);
        msg!("Publish time: {}", price.publish_time);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct GetPrice<'info> {
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[error_code]
pub enum OracleError {
    #[msg("Price is too old")]
    PriceTooOld,
}
