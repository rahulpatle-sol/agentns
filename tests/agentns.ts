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
  const REG_FEE = 10_000_000; // 0.01 SOL

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  // ---- helpers -------------------------------------------------------------

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
            opts.metadataUri ?? ""
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

  const alice = Keypair.generate();
  const bob = Keypair.generate();

  before(async () => {
    await airdrop(alice.publicKey);
    await airdrop(bob.publicKey);
  });

  // ---- config --------------------------------------------------------------

  it("initializes the registry config", async () => {
    await program.methods
      .initializeConfig(treasury.publicKey, resolverKey.publicKey, new anchor.BN(REG_FEE))
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.registryConfig.fetch(configPda);
    assert.equal(cfg.admin.toBase58(), admin.publicKey.toBase58());
    assert.equal(cfg.treasury.toBase58(), treasury.publicKey.toBase58());
    assert.equal(cfg.resolverPubkey.toBase58(), resolverKey.publicKey.toBase58());
    assert.equal(cfg.registrationFeeLamports.toNumber(), REG_FEE);
  });

  it("lets the admin rotate the resolver key", async () => {
    const newKey = Keypair.generate();
    await program.methods
      .updateConfig(null, newKey.publicKey, null)
      .accountsPartial({ admin: admin.publicKey, config: configPda })
      .rpc();
    let cfg = await program.account.registryConfig.fetch(configPda);
    assert.equal(cfg.resolverPubkey.toBase58(), newKey.publicKey.toBase58());

    await program.methods
      .updateConfig(null, resolverKey.publicKey, null)
      .accountsPartial({ admin: admin.publicKey, config: configPda })
      .rpc();
    cfg = await program.account.registryConfig.fetch(configPda);
    assert.equal(cfg.resolverPubkey.toBase58(), resolverKey.publicKey.toBase58());
  });

  it("rejects config updates from a non-admin", async () => {
    await expectFail(
      program.methods
        .updateConfig(null, null, new anchor.BN(0))
        .accountsPartial({ admin: alice.publicKey, config: configPda })
        .signers([alice])
        .rpc(),
      "Unauthorized"
    );
  });

  // ---- register ------------------------------------------------------------

  it("registers a name and charges the fee", async () => {
    const before = await connection.getBalance(treasury.publicKey);
    const r = register(alice);
    await r.run();

    const rec = await program.account.agentRecord.fetch(r.record);
    assert.equal(rec.owner.toBase58(), alice.publicKey.toBase58());
    assert.equal(rec.name, "mcp://sentiment.text-analysis.acme.v1.0");
    assert.equal(rec.endpoint, "https://sentiment.acme.dev/analyze");
    assert.deepEqual(rec.status, { active: {} });
    assert.deepEqual(rec.protocol, { mcp: {} });
    assert.equal(rec.stakeLamports.toNumber(), 0);
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
    const r = register(alice);
    const newAgentKey = Keypair.generate().publicKey;
    await program.methods
      .updateEndpoint("https://new.acme.dev/v2", newAgentKey, "https://acme.dev/agent.json")
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    const rec = await program.account.agentRecord.fetch(r.record);
    assert.equal(rec.endpoint, "https://new.acme.dev/v2");
    assert.equal(rec.agentPubkey.toBase58(), newAgentKey.toBase58());
    assert.equal(rec.metadataUri, "https://acme.dev/agent.json");
  });

  it("rejects endpoint updates from a non-owner", async () => {
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
    const r = register(alice, { agentId: "movable" });
    await r.run();

    await program.methods
      .transferName(bob.publicKey)
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    const rec = await program.account.agentRecord.fetch(r.record);
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

  it("rejects transferring to the same owner", async () => {
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
    const r = register(alice, { agentId: "short-lived" });
    await r.run();

    await program.methods
      .revokeName()
      .accountsPartial({ owner: alice.publicKey, agentRecord: r.record })
      .signers([alice])
      .rpc();

    const rec = await program.account.agentRecord.fetch(r.record);
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
    await expectFail(register(bob, { agentId: "short-lived" }).run(), "already in use");
  });
});
