import * as anchor from "@coral-xyz/anchor";
import type { Program } from "@coral-xyz/anchor";
import type { Favorites } from "../target/types/favorites";
import BN from "bn.js";
import { assert } from "chai";

describe("Favorites", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const user = provider.wallet.publicKey;
  const someoneElse = anchor.web3.Keypair.generate();
  const program = anchor.workspace.Favorites as Program<Favorites>;

  const favoriteNumber = new BN(42);
  const favoriteColor = "blue";
  const hobbies = ["reading", "writing", "coding"];

  before(async () => {
    const balance = await provider.connection.getBalance(user);
    const balanceInSol = balance / anchor.web3.LAMPORTS_PER_SOL;
    const formattedBalance = new Intl.NumberFormat().format(balanceInSol);
    console.log(`User ${user.toBase58()} has ${formattedBalance} SOL`);
  });

  it("Is initialized!", async () => {
    await program.methods
      .setFavorites(favoriteNumber, favoriteColor, hobbies)
      .accounts({
        user: user,
      })
      .rpc();

    const favoritesPdaAndBump = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("favorites"), user.toBuffer()],
      program.programId
    );

    const favoritesPda = favoritesPdaAndBump[0];
    const dataFromPda = await program.account.favorites.fetch(favoritesPda);

    assert.equal(dataFromPda.number.toString(), favoriteNumber.toString());
    assert.equal(dataFromPda.color, favoriteColor);
    assert.deepEqual(dataFromPda.hobbies, hobbies);
  });

  it("updates favorites", async () => {
    const newFavoriteHobbies = ["reading", "writing", "coding", "gaming"];
    try {
      await program.methods
        .setFavorites(favoriteNumber, favoriteColor, newFavoriteHobbies)
        .accounts({
          user: user,
        })
        .rpc();
    } catch (error) {
      console.log(error);
    }
  });

  it("reject transactions from unauthorized users", async () => {
    // someoneElseにエアドロップ
    const sig = await provider.connection.requestAirdrop(
      someoneElse.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );

    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );

    try {
      await program.methods
        .setFavorites(favoriteNumber, favoriteColor, hobbies)
        .accounts({
          user: someoneElse.publicKey,
        })
        .signers([someoneElse])
        .rpc();
    } catch (error) {
      console.log(error);
      const errorMessage = error.message.toString();
      console.log(errorMessage);
      assert.isTrue(errorMessage.includes("Signature verification failed"));
    }
  });
});
