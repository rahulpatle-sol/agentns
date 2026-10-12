import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { createHash } from "crypto";
import { Agentns } from "../target/types/agentns";

describe("agentns - phase 1 registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.agentns as Program<Agentns>;
  const connection = provider.connection;

  const admin = (provider.wallet as anchor.Wallet).payer;
  const treasury = Keypair.generate();
  const resolverKey = Keypair.generate();
  const REG_FEE = 10_000_000;
  const MIN_STAKE = 100_000_000;
  const SLASH_BPS = 1000;
  const COOLDOWN_SECS = 2;
  const MARKETPLACE_FEE_BPS = 250;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const fullName = (
    protocol: string,
    agentId: string,
    capability: string,
    providerName: string,
    version: string
  ) => `${protocol}://${agentId}.${capability}.${providerName}.v${version}`;

  const sha256 = (s: string): number[] =>
    Array.from(createHash("sha256").update(s).digest());

  const agentPda = (hash: number[]) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), Buffer.from(hash)],
      program.programId
    )[0];

  const airdrop = async (to: PublicKey, sol = 2) => {
    const sig = await connection.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  };

  const expectFail = async (p: Promise<unknown>, contains: string) => {
    try {
      await p;
    } catch (e: any) {
      const text = `${e?.error?.errorCode?.code ?? ""} ${e?.message ?? ""} ${String(e)} ${(e?.logs ?? []).join(" ")}`;
      assert.include(text, contains, `expected error containing "${contains}", got: ${text}`);
      return;
    }
    assert.fail(`expected failure containing "${contains}" but it succeeded`);
  };

  const register = (
    owner: Keypair,
    opts: {
      protocol?: "mcp" | "a2a" | "acp";
      agentId?: string;
      capability?: string;
      providerName?: string;
      version?: string;
      endpoint?: string;
      agentPubkey?: PublicKey;
      metadataUri?: string;
      hashOverride?: number[];
      stakeLamports?: number;
    } = {}
  ) => {
    const protocol = opts.protocol ?? "mcp";
    const agentId = opts.agentId ?? "sentiment";
    const capability = opts.capability ?? "text-analysis";
    const providerName = opts.providerName ?? "acme";
    const version = opts.version ?? "1.0";
    const hash = opts.hashOverride ?? sha256(fullName(protocol, agentId, capability, providerName, version));
    const record = agentPda(hash);
    const protocolArg =
      protocol === "mcp" ? { mcp: {} } : protocol === "a2a" ? { a2a: {} } : { acp: {} };
    const stake = opts.stakeLamports ?? MIN_STAKE;

    return {
      record,
      hash,
      run: () =>
        program.methods
          .registerName(
            hash,
            protocolArg,
            agentId,
            capability,
            providerName,
            version,
            opts.endpoint ?? "https://sentiment.acme.dev/analyze",
            opts.agentPubkey ?? Keypair.generate().publicKey,
            opts.metadataUri ?? "",
            new anchor.BN(stake)
          )
          .accountsPartial({
            owner: owner.publicKey,
            config: configPda,
            treasury: treasury.publicKey,
            agentRecord: record,
            systemProgram: SystemProgram.programId,
          })
          .signers([owner])
          .rpc(),
    };
  };

  const initConfig = async () => {
    await program.methods
      .initializeConfig(
        treasury.publicKey,
        resolverKey.publicKey,
        new anchor.BN(REG_FEE),
        new anchor.BN(MIN_STAKE),
        SLASH_BPS,
        // `unstake_cooldown_secs` is an i64, so it must be a BN. A plain number
        // makes the borsh encoder call `.toTwos()` on it and throw.
        new anchor.BN(COOLDOWN_SECS),
        MARKETPLACE_FEE_BPS
      )
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  };

  const ensureConfig = async () => {
    try {
      await program.account.registryConfig.fetch(configPda);
    } catch {
      await initConfig();
    }
  };

  const fetchRecord = (pda: PublicKey) => program.account.agentRecord.fetch(pda);

  const alice = Keypair.generate();
  const bob = Keypair.generate();

  before(async () => {
    await ensureConfig();
    await airdrop(alice.publicKey, 5);
    await airdrop(bob.publicKey, 5);
  });

  // ---- config --------------------------------------------------------------

  it("initializes the registry config", async () => {
    // Config should already be initialized from before hook
    const cfg = await program.account.registryConfig.fetch(configPda);
    assert.equal(cfg.admin.toBase58(), admin.publicKey.toBase58());
    assert.equal(cfg.treasury.toBase58(), treasury.publicKey.toBase58());
    assert.equal(cfg.resolverPubkey.toBase58(), resolverKey.publicKey.toBase58());
    assert.equal(cfg.registrationFeeLamports.toNumber(), REG_FEE);
    assert.equal(cfg.minStakeLamports.toNumber(), MIN_STAKE);
    assert.equal(cfg.slashBps, SLASH_BPS);
    assert.equal(cfg.unstakeCooldownSecs, COOLDOWN_SECS);
    assert.equal(cfg.marketplaceFeeBps, MARKETPLACE_FEE_BPS);
    assert.deepEqual(cfg.verifiers, []);
    assert.equal(cfg.unstakeCooldownSecs, COOLDOWN_SECS);
    assert.equal(cfg.marketplaceFeeBps, MARKETPLACE_FEE_BPS);
    assert.deepEqual(cfg.verifiers, []);
  });

  it("lets the admin rotate the resolver key", async () => {
    await ensureConfig();
    const newKey = Keypair.generate();
    await program.methods
      .updateConfig(null, newKey.publicKey, null, null, null, null, null)
      .accountsPartial({ admin: admin.publicKey, config: configPda })
      .rpc();
    let cfg = await program.account.registryConfig.fetch(configPda);
    assert.equal(cfg.resolverPubkey.toBase58(), newKey.publicKey.toBase58());

    await program.methods
      .updateConfig(null, resolverKey.publicKey, null, null, null, null, null)
      .accountsPartial({ admin: admin.publicKey, config: configPda })
      .rpc();
    cfg = await program.account.registryConfig.fetch(configPda);
    assert.equal(cfg.resolverPubkey.toBase58(), resolverKey.publicKey.toBase58());
  });

  it("rejects config updates from a non-admin", async () => {
    await ensureConfig();
    await expectFail(
      program.methods
        .updateConfig(null, null, new anchor.BN(0), null, null, null, null)
        .accountsPartial({ admin: alice.publicKey, config: configPda })
        .signers([alice])
        .rpc(),
      "Unauthorized"
    );
  });

  // ---- register ------------------------------------------------------------

  it("registers a name and charges the fee", async () => {
    await ensureConfig();
    const before = await connection.getBalance(treasury.publicKey);
    const r = register(alice);
    await r.run();

    const rec = await fetchRecord(r.record);
    assert.equal(rec.owner.toBase58(), alice.publicKey.toBase58());
    assert.equal(rec.name, "mcp://sentiment.text-analysis.acme.v1.0");
    assert.equal(rec.endpoint, "https://sentiment.acme.dev/analyze");
    assert.deepEqual(rec.status, { active: {} });
    assert.deepEqual(rec.protocol, { mcp: {} });
    assert.equal(rec.stakeLamports.toNumber(), MIN_STAKE);
    assert.equal(rec.passes, 0);
    assert.equal(rec.fails, 0);

    const after = await connection.getBalance(treasury.publicKey);
    assert.equal(after - before, REG_FEE);
  });

  it("rejects a duplicate name", async () => {
    await expectFail(register(bob).run(), "already in use");
  });

  it("rejects a name_hash that does not match the name", async () => {
    const wrong = sha256("totally-different-name");
    await expectFail(
      register(alice, { agentId: "other-agent", hashOverride: wrong }).run(),
      "NameHashMismatch"
    );
  });

  it("rejects a non-https endpoint", async () => {
    await expectFail(
      register(alice, { agentId: "plain-http", endpoint: "http://insecure.example.com" }).run(),
      "InvalidEndpoint"
    );
  });

  it("rejects an invalid name part (uppercase)", async () => {
    await expectFail(register(alice, { agentId: "BadName" }).run(), "InvalidNamePart");
  });

  it("rejects an invalid version", async () => {
    await expectFail(register(alice, { agentId: "bad-version", version: "1" }).run(), "InvalidVersion");
  });

  // ---- update --------------------------------------------------------------

  it("lets the owner update the endpoint", async () => {
    await ensureConfig();
    const r = register(alice);
    const newAgentKey = Keypair.generate().publicKey;
    await program.methods
      .updateEndpoint("https://new.acme.dev/v2", newAgentKey, "https://acme.dev/agent.json")
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    const rec = await fetchRecord(r.record);
    assert.equal(rec.endpoint, "https://new.acme.dev/v2");
    assert.equal(rec.agentPubkey.toBase58(), newAgentKey.toBase58());
    assert.equal(rec.metadataUri, "https://acme.dev/agent.json");
  });

  it("rejects endpoint updates from a non-owner", async () => {
    await ensureConfig();
    const r = register(alice);
    await expectFail(
      program.methods
        .updateEndpoint("https://evil.example.com", Keypair.generate().publicKey, "")
        .accountsPartial({ owner: bob.publicKey, agentRecord: r.record })
        .signers([bob])
        .rpc(),
      "NotOwner"
    );
  });

  // ---- transfer ------------------------------------------------------------

  it("transfers a name to a new owner", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "movable" });
    await r.run();

    await program.methods
      .transferName(bob.publicKey)
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    const rec = await fetchRecord(r.record);
    assert.equal(rec.owner.toBase58(), bob.publicKey.toBase58());

    await expectFail(
      program.methods
        .updateEndpoint("https://alice.example.com", Keypair.generate().publicKey, "")
        .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
        .signers([alice])
        .rpc(),
      "NotOwner"
    );

    await program.methods
      .updateEndpoint("https://bob.example.com", Keypair.generate().publicKey, "")
      .accountsPartial({ owner: bob.publicKey, agentRecord: r.record })
      .signers([bob])
      .rpc();
  });

  it("rejects transferring to the same owner", async () => {
    await ensureConfig();
    const r = register(alice);
    await expectFail(
      program.methods
        .transferName(alice.publicKey)
        .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
        .signers([alice])
        .rpc(),
      "SameOwner"
    );
  });

  // ---- revoke --------------------------------------------------------------

  it("revokes a name and keeps it reserved", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "short-lived" });
    await r.run();

    await program.methods
      .revokeName()
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    const rec = await fetchRecord(r.record);
    assert.deepEqual(rec.status, { revoked: {} });

    await expectFail(
      program.methods
        .updateEndpoint("https://again.example.com", Keypair.generate().publicKey, "")
        .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
        .signers([alice])
        .rpc(),
      "NameRevoked"
    );

    await expectFail(register(bob, { agentId: "short-lived" }).run(), "already in use");
  });

  // ---- marketplace ----------------------------------------------------------

  const listingPda = (record: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), record.toBuffer()],
      program.programId
    )[0];

  const listName = (
    owner: Keypair,
    record: PublicKey,
    priceLamports: number
  ) =>
    program.methods
      .listName(new anchor.BN(priceLamports))
      .accountsPartial({
        owner: owner.publicKey,
        agentRecord: record,
        listing: listingPda(record),
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

  const cancelListing = (
    seller: Keypair,
    record: PublicKey
  ) =>
    program.methods
      .cancelListing()
      .accountsPartial({
        seller: seller.publicKey,
        agentRecord: record,
        listing: listingPda(record),
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

  const buyName = (
    buyer: Keypair,
    record: PublicKey,
    seller: PublicKey,
    maxPriceLamports: number
  ) =>
    program.methods
      .buyName(new anchor.BN(maxPriceLamports))
      .accountsPartial({
        buyer: buyer.publicKey,
        config: configPda,
        treasury: treasury.publicKey,
        seller,
        agentRecord: record,
        listing: listingPda(record),
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

  it("lists a name for sale", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "for-sale" });
    await r.run();

    const price = 50_000_000;
    await listName(alice, r.record, price);

    const listing = await program.account.listing.fetch(listingPda(r.record));
    assert.equal(listing.seller.toBase58(), alice.publicKey.toBase58());
    assert.equal(listing.agentRecord.toBase58(), r.record.toBase58());
    assert.equal(listing.priceLamports.toNumber(), price);
    assert.equal(listing.createdAt.toNumber() > 0, true);
  });

  it("rejects listing with zero price", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "zero-price" });
    await r.run();

    await expectFail(listName(alice, r.record, 0), "InvalidPrice");
  });

  it("rejects listing a revoked name", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "revoked-list" });
    await r.run();
    await program.methods
      .revokeName()
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    await expectFail(listName(alice, r.record, 1_000_000), "NameRevoked");
  });

  it("cancels a listing and refunds rent to seller", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "cancel-me" });
    await r.run();
    await listName(alice, r.record, 50_000_000);

    const sellerBalanceBefore = await connection.getBalance(alice.publicKey);
    const listingPdaKey = listingPda(r.record);
    const listingBalanceBefore = await connection.getBalance(listingPdaKey);

    await cancelListing(alice, r.record);

    const sellerBalanceAfter = await connection.getBalance(alice.publicKey);
    assert.equal(sellerBalanceAfter > sellerBalanceBefore, true);

    try {
      await program.account.listing.fetch(listingPdaKey);
      assert.fail("listing account should be closed");
    } catch {
    }
  });

  it("rejects cancel from non-seller", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "not-seller-cancel" });
    await r.run();
    await listName(alice, r.record, 50_000_000);

    await expectFail(cancelListing(bob, r.record), "NotOwner");
  });

  it("buys a name and splits payment correctly", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "buy-me" });
    await r.run();
    const price = 80_000_000;
    await listName(alice, r.record, price);

    const expectedFee = Math.floor((price * MARKETPLACE_FEE_BPS) / 10_000);
    const expectedSellerAmount = price - expectedFee;

    const treasuryBefore = await connection.getBalance(treasury.publicKey);
    const sellerBefore = await connection.getBalance(alice.publicKey);

    await buyName(bob, r.record, alice.publicKey, price);

    const treasuryAfter = await connection.getBalance(treasury.publicKey);
    const sellerAfter = await connection.getBalance(alice.publicKey);

    assert.equal(treasuryAfter - treasuryBefore, expectedFee);
    assert.equal(sellerAfter - sellerBefore, expectedSellerAmount);

    const rec = await fetchRecord(r.record);
    assert.equal(rec.owner.toBase58(), bob.publicKey.toBase58());
    assert.equal(rec.endpointVerified, false);

    try {
      await program.account.listing.fetch(listingPda(r.record));
      assert.fail("listing account should be closed after purchase");
    } catch {
    }
  });

  it("rejects buying with max price below listing", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "price-too-low" });
    await r.run();
    await listName(alice, r.record, 100_000_000);

    await expectFail(buyName(bob, r.record, alice.publicKey, 50_000_000), "PriceAboveMax");
  });

  it("rejects buying your own listing", async () => {
    await ensureConfig();
    const r = register(alice, { agentId: "buy-own" });
    await r.run();
    await listName(alice, r.record, 50_000_000);

    await expectFail(buyName(alice, r.record, alice.publicKey, 100_000_000), "CannotBuyOwnName");
  });
});