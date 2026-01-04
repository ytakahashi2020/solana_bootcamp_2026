import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import BN from "bn.js";

import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";

// IDL は anchor build 後に生成される
// (パスはプロジェクト構成に合わせて調整)
import idl from "../target/idl/voting.json" with { type: "json" };

describe("voting (bankrun)", () => {
  // あなたの declare_id! と一致させる
  const programId = new PublicKey(
    "9ou6NkD8q13aWybmkMWnrE9tHWMYqGgzSpDwcVh9PVub"
  );

  let provider: BankrunProvider;
  let program: Program;

  before(async () => {
    // startAnchor の第1引数は workspace root を指すことが多い。
    // "" で動く構成もあるので、動かなければ "." や "../" を試してください。
    const context = await startAnchor("", [{ name: "voting", programId }], []);

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    // Program を IDL + programId で作る
    program = new Program(idl as anchor.Idl, provider);
  });

  function u64(n: number | string | bigint): BN {
    // u64 は必ず BN で渡す
    // 2^53 を超える可能性がある値は string/bigint で渡すのが安全
    return new BN(n.toString());
  }

  function findPollPda(pollId: BN): [PublicKey, number] {
    const seedPollId = pollId.toArrayLike(Buffer, "le", 8);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), seedPollId],
      programId
    );
  }

  function findCandidatePda(
    pollId: BN,
    candidateId: BN
  ): [PublicKey, number] {
    const seedPollId = pollId.toArrayLike(Buffer, "le", 8);
    const seedCandidateId = candidateId.toArrayLike(Buffer, "le", 8);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), seedPollId, seedCandidateId],
      programId
    );
  }

  it("initialize_poll creates poll_account and stores fields", async () => {
    const pollId = u64(1);
    const pollName = "Best Language";
    const pollDescription = "Vote your favorite";
    // vote を通しやすいように「常に active」な時間範囲にしておく
    const votingStart = u64(0);
    const votingEnd = u64("18446744073709551615"); // u64 max っぽく超大きい値

    const [pollPda] = findPollPda(pollId);

    await program.methods
      .initializePoll(pollId, pollName, pollDescription, votingStart, votingEnd)
      .accounts({
        payer: provider.wallet.publicKey,
        pollAccount: pollPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // account 名は IDL の生成に依存：PollAccount => pollAccount
    const poll = await program.account.pollAccount.fetch(pollPda);

    assert.equal(poll.pollId.toString(), pollId.toString());
    assert.equal(poll.pollName, pollName);
    assert.equal(poll.pollDescription, pollDescription);
    assert.equal(poll.pollVotingStart.toString(), votingStart.toString());
    assert.equal(poll.pollVotingEnd.toString(), votingEnd.toString());
    assert.equal(poll.candidateCount.toString(), "0");
  });

  it("initialize_candidate increments candidate_count and initializes candidate_account", async () => {
    const pollId = u64(2);
    const pollName = "Best L1";
    const pollDescription = "Pick one";
    const votingStart = u64(0);
    const votingEnd = u64("18446744073709551615");

    const [pollPda] = findPollPda(pollId);

    // poll を先に作る
    await program.methods
      .initializePoll(pollId, pollName, pollDescription, votingStart, votingEnd)
      .accounts({
        payer: provider.wallet.publicKey,
        pollAccount: pollPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // candidate 作成
    const candidateId = u64(10);
    const candidateName = "Solana";
    const [candidatePda] = findCandidatePda(pollId, candidateId);

    await program.methods
      .initializeCandidate(pollId, candidateId, candidateName)
      .accounts({
        payer: provider.wallet.publicKey,
        pollAccount: pollPda,
        candidateAccount: candidatePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // CanditateAccount（スペル）=> canditateAccount になるのが普通
    const candidate = await program.account.canditateAccount.fetch(
      candidatePda
    );
    assert.equal(candidate.candidateId.toString(), candidateId.toString());
    assert.equal(candidate.candidateName, candidateName);
    assert.equal(candidate.voteCount.toString(), "0");

    // poll の candidate_count が +1 されていること
    const poll = await program.account.pollAccount.fetch(pollPda);
    assert.equal(poll.candidateCount.toString(), "1");
  });

  it("vote increments vote_count when poll is active", async () => {
    const pollId = u64(3);
    const [pollPda] = findPollPda(pollId);

    // 現在時刻を基準に、過去から未来までの範囲を設定
    const now = Math.floor(Date.now() / 1000);
    const votingStart = u64(now - 3600); // 1時間前
    const votingEnd = u64(now + 3600);   // 1時間後

    await program.methods
      .initializePoll(
        pollId,
        "Best DEX",
        "Vote",
        votingStart,
        votingEnd
      )
      .accounts({
        payer: provider.wallet.publicKey,
        pollAccount: pollPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const candidateId = u64(1);
    const [candidatePda] = findCandidatePda(pollId, candidateId);

    await program.methods
      .initializeCandidate(pollId, candidateId, "Jupiter")
      .accounts({
        payer: provider.wallet.publicKey,
        pollAccount: pollPda,
        candidateAccount: candidatePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // 投票者は別 Keypair にする（payer と同じでも動くがテストとして分ける）
    const voter = Keypair.generate();

    // Bankrun は validator 不要だが、署名者が rent 払うわけではないので
    // vote では lamports いらない（あなたの Vote は init しないので）
    await program.methods
      .vote(pollId, candidateId)
      .accounts({
        voter: voter.publicKey,
        pollAccount: pollPda,
        candidateAccount: candidatePda,
      })
      .signers([voter])
      .rpc();

    const candidateAfter = await program.account.canditateAccount.fetch(
      candidatePda
    );
    assert.equal(candidateAfter.voteCount.toString(), "1");
  });

  it("vote fails with PollNotActive when outside the voting window", async () => {
    const pollId = u64(4);
    const [pollPda] = findPollPda(pollId);

    // 現在時刻は通常 0 付近から始まるので、start を未来にして PollNotActive を確実に出す
    await program.methods
      .initializePoll(
        pollId,
        "Future poll",
        "Not active yet",
        u64(9999999999), // 未来
        u64(9999999999 + 1000)
      )
      .accounts({
        payer: provider.wallet.publicKey,
        pollAccount: pollPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const candidateId = u64(1);
    const [candidatePda] = findCandidatePda(pollId, candidateId);

    await program.methods
      .initializeCandidate(pollId, candidateId, "Alice")
      .accounts({
        payer: provider.wallet.publicKey,
        pollAccount: pollPda,
        candidateAccount: candidatePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const voter = Keypair.generate();

    try {
      await program.methods
        .vote(pollId, candidateId)
        .accounts({
          voter: voter.publicKey,
          pollAccount: pollPda,
          candidateAccount: candidatePda,
        })
        .signers([voter])
        .rpc();

      assert.fail("Expected vote() to throw PollNotActive");
    } catch (e: any) {
      // Anchor のエラー取り出しはバージョンで揺れるので、安全に見る
      const msg = `${e?.error?.errorMessage ?? e?.message ?? e}`;
      // 文字列で十分（確実性高い）
      assert.isTrue(
        msg.includes("Poll is not active") || msg.includes("PollNotActive"),
        `Unexpected error message: ${msg}`
      );
    }
  });
});
