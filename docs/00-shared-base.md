## Common rules (read first)

- Stack: Anchor CLI 1.2.1, anchor-lang 1.2.1, Solana CLI 3.1.10, Rust 1.98, Node 24, yarn. Tests are TypeScript (mocha) using `@anchor-lang/core`.
- Work ONLY in the files listed in this prompt. Do not touch any other file. Do not change `declare_id!`, `Anchor.toml`, any `Cargo.toml` or `package.json`. If you think you must, stop and ask me.
- Read the existing code before you write anything. Follow its style and naming.
- Comments must be easy for a beginner. Every `pub` struct, enum, function and instruction gets a short doc comment (`///`) in plain English that says WHAT it does and WHY it exists. Add short `//` comments before every non-obvious step (math, moving lamports, checks). No clever one-liners.
- Tests must be easy to read. Every `it(...)` has a one-line comment above it saying what is checked and why it matters. Use clear test names.

### Anchor 1.x gotchas (we already hit these in this project)

1. `#[instruction(...)]` on an Accounts struct must list the same args, in the same order and types, as the handler.
2. If two mutable accounts can be the same wallet (for example owner = treasury on devnet), put `dup` on the second one: `#[account(mut, dup, ...)]`.
3. `CpiContext::new` takes the program id (a Pubkey): `CpiContext::new(ctx.accounts.system_program.key(), ...)`.
4. Hashing: use the `solana_sha256_hasher` crate (already a dependency). `anchor_lang::solana_program::hash` does not exist in 1.x.
5. Never create `src/instructions.rs` (the folder `src/instructions/mod.rs` already exists). Never add a second `#[error_code]` enum.
6. To move lamports OUT of an account owned by this program, use the `Lamports` trait from the prelude: `account.sub_lamports(n)?` and `other.add_lamports(n)?`. A System Program transfer CPI cannot debit a program-owned account. Never let a program-owned account drop below its rent-exempt minimum. If the borrow checker complains, do the lamport moves first and update the struct fields after.
7. TypeScript tests: use `.accountsPartial({...})` and pass every account. Enum args look like `{ mcp: {} }`. u64/i64 are `new anchor.BN(x)`. u16/u32 are plain numbers. Account namespaces are camelCase, for example `program.account.agentRecord`.
8. If `anchor test` says port 8899 is in use: run `pkill -f surfpool; pkill -f solana-test-validator`, then retry. If Surfpool is missing use `anchor test --validator legacy`.
9. Use unique agent ids in tests (prefix is given below) so different test files never collide on the same name.

## Acceptance (do all of this)

Run these in order and fix problems until everything passes:

1. `cargo test -p agentns`
2. `anchor build`
3. `anchor test`

Then run `git status` and `git diff --stat`, and check that ONLY the files listed in this prompt changed. Commit on the current branch with the commit message given below. Do not push. Do not switch or touch other branches.

Final report to me: (1) what you changed in each file, (2) how many tests pass, (3) anything you were unsure about or decided on your own.

---

# Prompt 00 - Shared base (run on branch `main`)

You are working on an Anchor program called `agentns` (an on-chain name registry for AI agents). Phase 1 is finished and its 14 tests pass.

## Goal

Prepare a shared base so that Phase 2 (trust / stake) and Phase 3 (marketplace) can be built later on two separate git branches and merged with no conflicts.

**Do NOT add any new behavior.** Only add the fields, constants, errors, events and file layout below, and keep all 14 existing tests green.

Why: both phases need new config fields, new record fields, new errors, new events and new lines in `lib.rs` and `instructions/mod.rs`. If each branch edited those shared files, the merge would conflict. So we add all shared pieces now, once.

## Files you may change

`programs/agentns/src/constants.rs`, `state.rs`, `errors.rs`, `events.rs`, `lib.rs`, `instructions/mod.rs`, `instructions/initialize_config.rs`, `instructions/update_config.rs`, `instructions/register_name.rs`, plus `tests/agentns.ts` and a NEW file `tests/helpers.ts`.

## Tasks

### A. constants.rs
Add:
```rust
pub const LISTING_SEED: &[u8] = b"listing";
pub const MAX_VERIFIERS: usize = 8;
pub const MAX_BPS: u16 = 10_000;               // 100 percent
pub const MAX_MARKETPLACE_FEE_BPS: u16 = 1_000; // 10 percent cap on the sale fee
```

### B. state.rs
- `RegistryConfig`: add these fields after `registration_fee_lamports` and before `bump`:
  - `min_stake_lamports: u64` (minimum stake needed to register, Phase 2)
  - `slash_bps: u16` (share of stake taken on a failed challenge, Phase 2)
  - `unstake_cooldown_secs: i64` (wait time before stake can be withdrawn, Phase 2)
  - `marketplace_fee_bps: u16` (fee on every sale, Phase 3)
  - `verifiers: Vec<Pubkey>` with `#[max_len(MAX_VERIFIERS)]` (wallets allowed to report challenges, Phase 2)
- `AgentRecord`: add before `bump`:
  - `unstake_requested_at: i64` (0 means no unstake is pending)
  - `endpoint_verified: bool`
- Do NOT add a `Listing` struct. Phase 3 adds it later at the bottom of this file.
- Add a doc comment on every new field explaining what it is for.

### C. errors.rs
Keep the existing variants unchanged. Add these NEW variants at the END of the enum, each with a clear `#[msg("...")]`:

- Shared: `InvalidBps`, `InvalidCooldown`, `MathOverflow`
- Phase 2: `StakeBelowMinimum`, `NotAVerifier`, `TooManyVerifiers`, `DuplicateVerifier`, `NoStakeToWithdraw`, `UnstakeNotRequested`, `UnstakeAlreadyRequested`, `CooldownNotFinished`, `StakeInvariantBroken`
- Phase 3: `InvalidPrice`, `ListingStale`, `PriceAboveMax`, `UnstakePending`, `CannotBuyOwnName`, `ListingMismatch`

### D. events.rs
Keep existing events. Extend `ConfigUpdated` with `min_stake_lamports`, `slash_bps`, `unstake_cooldown_secs`, `marketplace_fee_bps`. Then ADD these new `#[event]` structs (all include `timestamp: i64`):

- Phase 2:
  - `StakeAdded { name_hash: [u8;32], owner: Pubkey, amount: u64, total_stake: u64 }`
  - `UnstakeRequested { name_hash: [u8;32], owner: Pubkey, available_at: i64 }`
  - `StakeWithdrawn { name_hash: [u8;32], owner: Pubkey, amount: u64 }`
  - `ChallengeReported { name_hash: [u8;32], verifier: Pubkey, passed: bool, slashed_lamports: u64, passes: u32, fails: u32 }`
  - `EndpointVerified { name_hash: [u8;32], verifier: Pubkey }`
  - `VerifiersUpdated { verifiers: Vec<Pubkey> }`
- Phase 3:
  - `NameListed { name_hash: [u8;32], seller: Pubkey, price_lamports: u64 }`
  - `ListingCancelled { name_hash: [u8;32], seller: Pubkey }`
  - `NameSold { name_hash: [u8;32], seller: Pubkey, buyer: Pubkey, price_lamports: u64, fee_lamports: u64 }`

### E. instructions/initialize_config.rs
New handler args, added after `registration_fee_lamports`: `min_stake_lamports: u64`, `slash_bps: u16`, `unstake_cooldown_secs: i64`, `marketplace_fee_bps: u16`. Store them; set `verifiers` to an empty Vec. Validate: `slash_bps <= MAX_BPS` and `marketplace_fee_bps <= MAX_MARKETPLACE_FEE_BPS` (else `InvalidBps`), `unstake_cooldown_secs >= 0` (else `InvalidCooldown`). Emit the extended `ConfigUpdated`.

### F. instructions/update_config.rs
Add four new `Option` args after `new_registration_fee_lamports`, in this order: `new_min_stake_lamports: Option<u64>`, `new_slash_bps: Option<u16>`, `new_unstake_cooldown_secs: Option<i64>`, `new_marketplace_fee_bps: Option<u16>`. Same validation as in `initialize_config`. `None` means keep the old value. Verifiers are NOT changed here (Phase 2 adds `set_verifiers`).

### G. instructions/register_name.rs
Only initialize the two new record fields: `record.unstake_requested_at = 0;` and `record.endpoint_verified = false;`. No other change.

### H. lib.rs and instructions/mod.rs (IMPORTANT for clean merges)
1. Update the wrappers for `initialize_config` and `update_config` to the new args.
2. Re-organize the `#[program]` module and `instructions/mod.rs` with section markers, so each later branch only edits its own section. Use exactly this layout, with TWO blank lines after each marker section:

`instructions/mod.rs`:
```rust
// ===== Phase 1: registry =====
pub mod initialize_config;
pub mod register_name;
pub mod revoke_name;
pub mod transfer_name;
pub mod update_config;
pub mod update_endpoint;

pub use initialize_config::*;
pub use register_name::*;
pub use revoke_name::*;
pub use transfer_name::*;
pub use update_config::*;
pub use update_endpoint::*;


// ===== Phase 2: trust / stake (added in branch phase2-trust) =====
// New `pub mod` and `pub use` lines for Phase 2 go directly below this line.


// ===== Phase 3: marketplace (added in branch phase3-marketplace) =====
// New `pub mod` and `pub use` lines for Phase 3 go directly below this line.
```

In `lib.rs`, inside `pub mod agentns { ... }`, keep the Phase 1 functions first, then add:
```rust
    // ===== Phase 2: trust / stake (added in branch phase2-trust) =====
    // New Phase 2 instructions go directly below this line.


    // ===== Phase 3: marketplace (added in branch phase3-marketplace) =====
    // New Phase 3 instructions go directly below this line.
```
Keep the marker lines exactly as written. Later branches add code only under their own marker.

### I. tests/helpers.ts (NEW) and tests/agentns.ts
Create `tests/helpers.ts` that exports (move the helper code out of `agentns.ts`; keep behavior identical):

- `provider`, `program`, `connection`, `admin` (the provider wallet payer)
- `treasury` and `resolverKey` (module-level `Keypair.generate()` so every test file shares them)
- `TEST_CONFIG = { registrationFee: 10_000_000, minStake: 100_000_000, slashBps: 1000, cooldownSecs: 2, marketplaceFeeBps: 250 }`
- `configPda`, `fullName(...)`, `sha256(...)`, `agentPda(hash)`
- `airdrop(pubkey, sol)`, `fundedKeypair(sol = 10)` (generate + airdrop), `sleep(ms)`
- `expectFail(promise, contains)` (same logic as the current helper)
- `initConfig()` which calls `initializeConfig` with TEST_CONFIG values
- `ensureConfig()` which fetches the config account and only calls `initConfig()` if it does not exist yet
- `registerName(owner, opts)` which returns `{ record, hash, run }` exactly like the current `register` helper (same options). Every test file must register names ONLY through this helper, never by calling `program.methods.registerName` directly. Reason: Phase 2 will change the register arguments in this one place.
- `fetchRecord(pda)` which returns `program.account.agentRecord.fetch(pda)`

Update `tests/agentns.ts` to import everything from `./helpers`. Keep all 14 tests and their meaning. The "initializes the registry config" test must call `initConfig()` and also assert the 4 new config fields. Update the config tests to the new `updateConfig` argument list. Keep the existing agent ids used by the Phase 1 tests as they are (later phases use their own prefixes `p2-` and `p3-`).

## Commit message
`chore: shared base for phase 2 and phase 3 (config fields, errors, events, test helpers)`