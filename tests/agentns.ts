import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Agentns } from "../target/types/agentns";
import {
  provider,
  program,
  connection,
  admin,
  treasury,
  resolverKey,
  TEST_CONFIG,
  MIN_STAKE,
  configPda,
  airdrop,
  fundedKeypair,
  expectFail,
  initConfig,
  ensureConfig,
  registerName,
  fetchRecord,
} from "./helpers";

describe("agentns - phase 1 registry", () => {
  const alice = Keypair.generate();
  const bob = Keypair.generate();

  before(async () => {
    await ensureConfig();
    await airdrop(alice.publicKey, 5);
    await airdrop(bob.publicKey, 5);
  });

  // ---- config --------------------------------------------------------------

  // Initializes the registry config and checks all fields including new Phase 2/3 fields.
  it("initializes the registry config", async () => {
    await initConfig();

    const cfg = await program.account.registryConfig.fetch(configPda);
    assert.equal(cfg.admin.toBase58(), admin.publicKey.toBase58());
    assert.equal(cfg.treasury.toBase58(), treasury.publicKey.toBase58());
    assert.equal(cfg.resolverPubkey.toBase58(), resolverKey.publicKey.toBase58());
    assert.equal(cfg.registrationFeeLamports.toNumber(), TEST_CONFIG.registrationFee);
    // New fields from shared base
    assert.equal(cfg.minStakeLamports.toNumber(), TEST_CONFIG.minStake);
    assert.equal(cfg.slashBps, TEST_CONFIG.slashBps);
    assert.equal(cfg.unstakeCooldownSecs, TEST_CONFIG.cooldownSecs);
    assert.equal(cfg.marketplaceFeeBps, TEST_CONFIG.marketplaceFeeBps);
    assert.deepEqual(cfg.verifiers, []);
  });

  // Admin can rotate resolver key and other new config fields.
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

  // Non-admin cannot update config.
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

  // Registering a name charges the fee and initializes stake to MIN_STAKE.
  it("registers a name and charges the fee", async () => {
    await ensureConfig();
    const before = await connection.getBalance(treasury.publicKey);
    const r = registerName(alice);
    await r.run();

    const rec = await fetchRecord(r.record);
    assert.equal(rec.owner.toBase58(), alice.publicKey.toBase58());
    assert.equal(rec.name, "mcp://sentiment.text-analysis.acme.v1.0");
    assert.equal(rec.endpoint, "https://sentiment.acme.dev/analyze");
    assert.deepEqual(rec.status, { active: {} });
    assert.deepEqual(rec.protocol, { mcp: {} });
    // Stake is now MIN_STAKE (not 0)
    assert.equal(rec.stakeLamports.toNumber(), MIN_STAKE);
    assert.equal(rec.passes, 0);
    assert.equal(rec.fails, 0);

    const after = await connection.getBalance(treasury.publicKey);
    assert.equal(after - before, TEST_CONFIG.registrationFee);
  });

  // Duplicate name registration fails.
  it("rejects a duplicate name", async () => {
    await expectFail(registerName(bob).run(), "already in use");
  });

  // Wrong name_hash fails.
  it("rejects a name_hash that does not match the name", async () => {
    const wrong = sha256("totally-different-name");
    await expectFail(
      registerName(alice, { agentId: "other-agent", hashOverride: wrong }).run(),
      "NameHashMismatch"
    );
  });

  // Non-HTTPS endpoint fails.
  it("rejects a non-https endpoint", async () => {
    await expectFail(
      registerName(alice, { agentId: "plain-http", endpoint: "http://insecure.example.com" }).run(),
      "InvalidEndpoint"
    );
  });

  // Uppercase in name part fails.
  it("rejects an invalid name part (uppercase)", async () => {
    await expectFail(registerName(alice, { agentId: "BadName" }).run(), "InvalidNamePart");
  });

  // Invalid version format fails.
  it("rejects an invalid version", async () => {
    await expectFail(registerName(alice, { agentId: "bad-version", version: "1" }).run(), "InvalidVersion");
  });

  // ---- update --------------------------------------------------------------

  // Owner can update endpoint.
  it("lets the owner update the endpoint", async () => {
    await ensureConfig();
    const r = registerName(alice);
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

  // Non-owner cannot update endpoint.
  it("rejects endpoint updates from a non-owner", async () => {
    await ensureConfig();
    const r = registerName(alice);
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

  // Transfer changes owner.
  it("transfers a name to a new owner", async () => {
    await ensureConfig();
    const r = registerName(alice, { agentId: "movable" });
    await r.run();

    await program.methods
      .transferName(bob.publicKey)
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    const rec = await fetchRecord(r.record);
    assert.equal(rec.owner.toBase58(), bob.publicKey.toBase58());

    // old owner is locked out
    await expectFail(
      program.methods
        .updateEndpoint("https://alice.example.com", Keypair.generate().publicKey, "")
        .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
        .signers([alice])
        .rpc(),
      "NotOwner"
    );

    // new owner can update
    await program.methods
      .updateEndpoint("https://bob.example.com", Keypair.generate().publicKey, "")
      .accountsPartial({ owner: bob.publicKey, agentRecord: r.record })
      .signers([bob])
      .rpc();
  });

  // Cannot transfer to self.
  it("rejects transferring to the same owner", async () => {
    await ensureConfig();
    const r = registerName(alice);
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

  // Revoke marks name revoked and keeps it reserved.
  it("revokes a name and keeps it reserved", async () => {
    await ensureConfig();
    const r = registerName(alice, { agentId: "short-lived" });
    await r.run();

    await program.methods
      .revokeName()
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    const rec = await fetchRecord(r.record);
    assert.deepEqual(rec.status, { revoked: {} });

    // cannot update a revoked name
    await expectFail(
      program.methods
        .updateEndpoint("https://again.example.com", Keypair.generate().publicKey, "")
        .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
        .signers([alice])
        .rpc(),
      "NameRevoked"
    );

    // nobody can re-register it (stays reserved)
    await expectFail(registerName(bob, { agentId: "short-lived" }).run(), "already in use");
  });
});