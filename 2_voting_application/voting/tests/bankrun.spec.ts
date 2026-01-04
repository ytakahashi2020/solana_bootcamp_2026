import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { startAnchor } from "anchor-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { Voting } from "../target/types/voting.js";
import { BN } from "bn.js";
import { Clock, ProgramTestContext,BanksClient } from "solana-bankrun";

import IDL from "../target/idl/voting.json" with { type: "json" };
import { assert } from "chai";


describe("voting(bankrun)", () => {
  const programId = new PublicKey(
    "9ou6NkD8q13aWybmkMWnrE9tHWMYqGgzSpDwcVh9PVub"
  );

  let program: Program<Voting>;
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let banksClient: BanksClient;

  before(async () => {
    context = await startAnchor("", [{ name: "voting", programId }], []);

    provider = new BankrunProvider(context);

    anchor.setProvider(provider);

    program = new Program<Voting>(IDL as Voting, provider);
    banksClient = context.banksClient;
  });

  it("initialize poll", async () => {
    const pollId = new BN(1);
    const pollName = "Test Poll";
    const pollDescription = "This is a test poll";
    const pollVotingStart = new BN(0);
    const pollVotingEnd = new BN(100);

    const [pollPda] = PublicKey.findProgramAddressSync([Buffer.from("poll"), pollId.toArrayLike(Buffer, "le", 8)], programId);

    await program.methods.initializePoll(pollId, pollName, pollDescription, pollVotingStart, pollVotingEnd).accounts({
      payer: provider.wallet.publicKey,
    }).rpc();

    const candidateId = new BN(10);
    const candidateName = "Solana";
    const [candidatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("candidate"), 
        pollId.toArrayLike(Buffer, "le", 8), 
        candidateId.toArrayLike(Buffer, "le", 8)], programId);

    await program.methods
      .initializeCandidate(pollId, candidateId, candidateName)
      .accounts({
        payer: provider.wallet.publicKey,
      })
      .rpc();

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
  it("vote for candidate", async () => {

    const pollId = new BN(1);
    const candidateId = new BN(10);

    await new Promise((resolve) => setTimeout(resolve, 1000))

    const currentClock = await banksClient.getClock()
    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        60n,
      ),
    )

    await program.methods.vote(pollId, candidateId).accounts({
      voter: provider.wallet.publicKey,
    }).rpc();
    const [candidatePda] = PublicKey.findProgramAddressSync([
        Buffer.from("candidate"), 
        pollId.toArrayLike(Buffer, "le", 8), 
        candidateId.toArrayLike(Buffer, "le", 8)
    ], programId);

    const candidate = await program.account.canditateAccount.fetch(
      candidatePda
    );
    assert.equal(candidate.voteCount.toString(), "1");
  });
});