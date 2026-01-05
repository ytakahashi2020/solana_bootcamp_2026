import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Crud } from "../target/types/crud";
import { BanksClient, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Connection } from "@solana/web3.js";
import IDL from "../target/idl/crud.json";
import { expect } from "chai";
import { assert } from "chai";
import BN from "bn.js";

describe("crud", () => {
  const programId = new PublicKey(
    "AJuvFF7KaLxX2CodX1CFrU8xFw8PvenTU6H6CAqB83Xk"
  );

  let program: Program<Crud>;
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let banksClient: BanksClient;
  const memoId = new BN(1);
  const title = "Test Title";
  const message = "Test Message";
  before(async () => {
    context = await startAnchor("", [{ name: "crud", programId }], []);
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    program = new Program<Crud>(IDL as Crud, provider);
  });
  it("should initialize a memo", async () => {
    const [memo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("memo"),
        memoId.toArrayLike(Buffer, "le", 8),
        provider.wallet.publicKey.toBuffer(),
      ],
      programId
    );

    await program.methods
      .createMemo(memoId, title, message)
      .accounts({
        user: provider.wallet.publicKey,
      })
      .rpc();
    const memoAccount = await program.account.memo.fetch(memo);
    assert(memoAccount.memoId.eq(memoId));
    assert(memoAccount.owner.equals(provider.wallet.publicKey));
    assert(memoAccount.title === title);
    assert(memoAccount.message === message);
  });
  it("should update a memo", async () => {
    const newTitle = "New Title";
    const newMessage = "New Message";

    const [memo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("memo"),
        memoId.toArrayLike(Buffer, "le", 8),
        provider.wallet.publicKey.toBuffer(),
      ],
      programId
    );

    await program.methods
      .updateMemo(memoId, newTitle, newMessage)
      .accounts({
        user: provider.wallet.publicKey,
      })
      .rpc();

    const memoAccount = await program.account.memo.fetch(memo);
    assert(memoAccount.memoId.eq(memoId));
    assert(memoAccount.owner.equals(provider.wallet.publicKey));
    assert(memoAccount.title === newTitle);
    assert(memoAccount.message === newMessage);
  });

  it("should delete a memo", async () => {
    const [memo] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("memo"),
        memoId.toArrayLike(Buffer, "le", 8),
        provider.wallet.publicKey.toBuffer(),
      ],
      programId
    );
    await program.methods
      .deleteMemo(memoId)
      .accounts({
        user: provider.wallet.publicKey,
      })
      .rpc();
    // 削除後にアカウントを取得しようとするとエラーになることを確認
    try {
      await program.account.memo.fetch(memo);
      assert.fail("Account should not exist after deletion");
    } catch (error) {
      // Anchor returns "Could not find <address>" when account doesn't exist
      expect(error.message).to.include("Could not find");
    }
  });
});
