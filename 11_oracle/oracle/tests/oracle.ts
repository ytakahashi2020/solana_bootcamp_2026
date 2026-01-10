import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Oracle } from "../target/types/oracle";
import { PublicKey } from "@solana/web3.js";
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";

// SOL/USD Price Feed ID
const SOL_USD_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

// USDC/USD Price Feed ID
const USDC_USD_FEED_ID =
  "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

describe("oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Oracle as Program<Oracle>;
  const wallet = provider.wallet as anchor.Wallet;

  // Initialize Hermes client and Pyth Solana Receiver
  const hermesClient = new HermesClient("https://hermes.pyth.network", {});
  let pythSolanaReceiver: PythSolanaReceiver;

  before(async () => {
    pythSolanaReceiver = new PythSolanaReceiver({
      connection: provider.connection,
      wallet: wallet,
    });
  });

  it("Fetches SOL/USD price from Pyth", async () => {
    // Fetch price update from Hermes
    const priceUpdateData = await hermesClient.getLatestPriceUpdates([
      SOL_USD_FEED_ID,
    ]);

    console.log("Fetched price update from Hermes");

    // Get the transaction builder
    const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: true,
    });

    // Add price update instruction
    await transactionBuilder.addPostPriceUpdates(priceUpdateData.binary.data);

    // Add our program's instruction to read the price
    await transactionBuilder.addPriceConsumerInstructions(
      async (
        getPriceUpdateAccount: (feedId: string) => PublicKey
      ): Promise<anchor.web3.TransactionInstruction[]> => {
        const priceUpdateAccount = getPriceUpdateAccount(SOL_USD_FEED_ID);

        return [
          await program.methods
            .getSolPrice()
            .accounts({
              priceUpdate: priceUpdateAccount,
            })
            .instruction(),
        ];
      }
    );

    // Build and send the transaction
    const transactions = await transactionBuilder.buildVersionedTransactions({
      tightComputeBudget: true,
    });

    console.log("Sending transactions...");

    for (const tx of transactions) {
      const signature = await provider.connection.sendTransaction(tx, {
        skipPreflight: true,
      });
      await provider.connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed:", signature);
    }

    console.log("Successfully fetched SOL/USD price!");
  });

  it("Fetches USDC/USD price from Pyth", async () => {
    // Fetch price update from Hermes
    const priceUpdateData = await hermesClient.getLatestPriceUpdates([
      USDC_USD_FEED_ID,
    ]);

    console.log("Fetched USDC price update from Hermes");

    // Get the transaction builder
    const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: true,
    });

    // Add price update instruction
    await transactionBuilder.addPostPriceUpdates(priceUpdateData.binary.data);

    // Add our program's instruction to read the price
    await transactionBuilder.addPriceConsumerInstructions(
      async (
        getPriceUpdateAccount: (feedId: string) => PublicKey
      ): Promise<anchor.web3.TransactionInstruction[]> => {
        const priceUpdateAccount = getPriceUpdateAccount(USDC_USD_FEED_ID);

        return [
          await program.methods
            .getUsdcPrice()
            .accounts({
              priceUpdate: priceUpdateAccount,
            })
            .instruction(),
        ];
      }
    );

    // Build and send the transaction
    const transactions = await transactionBuilder.buildVersionedTransactions({
      tightComputeBudget: true,
    });

    console.log("Sending transactions...");

    for (const tx of transactions) {
      const signature = await provider.connection.sendTransaction(tx, {
        skipPreflight: true,
      });
      await provider.connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed:", signature);
    }

    console.log("Successfully fetched USDC/USD price!");
  });

  it("Fetches price by custom feed ID", async () => {
    // Using SOL/USD feed as example
    const priceUpdateData = await hermesClient.getLatestPriceUpdates([
      SOL_USD_FEED_ID,
    ]);

    console.log("Fetched price update for custom feed ID");

    const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: true,
    });

    await transactionBuilder.addPostPriceUpdates(priceUpdateData.binary.data);

    await transactionBuilder.addPriceConsumerInstructions(
      async (
        getPriceUpdateAccount: (feedId: string) => PublicKey
      ): Promise<anchor.web3.TransactionInstruction[]> => {
        const priceUpdateAccount = getPriceUpdateAccount(SOL_USD_FEED_ID);

        return [
          await program.methods
            .getPriceByFeedId(SOL_USD_FEED_ID)
            .accounts({
              priceUpdate: priceUpdateAccount,
            })
            .instruction(),
        ];
      }
    );

    const transactions = await transactionBuilder.buildVersionedTransactions({
      tightComputeBudget: true,
    });

    console.log("Sending transactions...");

    for (const tx of transactions) {
      const signature = await provider.connection.sendTransaction(tx, {
        skipPreflight: true,
      });
      await provider.connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed:", signature);
    }

    console.log("Successfully fetched price by custom feed ID!");
  });
});
