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

# Prompt 01 - Phase 2: Trust / Stake (run on branch `phase2-trust`)

Prerequisite: prompt 00 (shared base) is already committed on `main`, and this branch was created from `main`. Config fields (`min_stake_lamports`, `slash_bps`, `unstake_cooldown_secs`, `verifiers`), record fields (`unstake_requested_at`, `endpoint_verified`), error variants and event structs already exist. Do not re-create them.

## Goal

Add the trust layer: agents put SOL behind their name (stake), trusted verifiers test them, failed tests slash a share of the stake, and the stake can be withdrawn only after a cooldown.

## Design decisions (follow exactly)

1. **The stake lives inside the `AgentRecord` account itself.** The record's lamports = rent-exempt minimum + `stake_lamports`. There is no separate vault account. Why: simpler, and the stake automatically follows the name when ownership changes later (Phase 3).
2. Invariant that must always hold: `record lamports >= rent_exempt_minimum(record data length)`. Only ever move `stake_lamports` worth of lamports out. Check this invariant before every payout and return `StakeInvariantBroken` if it would break.
3. Move lamports out of the record with `sub_lamports` / `add_lamports` (not a System CPI). Move lamports INTO the record (stake deposits) with a normal System Program transfer CPI.
4. Slash amount = `stake_lamports * slash_bps / 10_000`, computed with `u128` math, rounded down, never more than the stake. Slashed lamports go to the treasury.
5. Verifiers are wallets listed in `config.verifiers`. Only the admin can change that list.
6. A revoked name keeps its stake locked until the cooldown ends, and verifiers can still slash it during that time (so nobody can dodge a slash by revoking).

## Files you may change

NEW files in `programs/agentns/src/instructions/`:
- `top_up_stake.rs`, `request_unstake.rs`, `withdraw_stake.rs`, `report_challenge.rs`, `mark_endpoint_verified.rs`, `set_verifiers.rs`

MODIFIED:
- `instructions/register_name.rs` (now requires a stake)
- `instructions/revoke_name.rs` (revoking starts the cooldown)
- `instructions/update_endpoint.rs` (changing endpoint clears the verified flag)
- `instructions/mod.rs` and `lib.rs` (add lines ONLY under the "Phase 2" marker comments, never anywhere else)
- `tests/helpers.ts` (register helper gets a stake argument)
- `tests/agentns.ts` (only the assertions/airdrop amounts that the new stake changes)
- NEW: `tests/phase2-trust.ts`

Do NOT touch `state.rs`, `errors.rs`, `events.rs`, `constants.rs`, `initialize_config.rs`, `update_config.rs`, `transfer_name.rs`. Everything you need is already there.

## Tasks

### 1. register_name.rs (modify)
- Add a new LAST handler arg `stake_lamports: u64` (after `metadata_uri`). Update `#[instruction(...)]` and the wrapper in `lib.rs` to match.
- Require `stake_lamports >= config.min_stake_lamports`, else `StakeBelowMinimum`.
- Order inside the handler: validate inputs, check the name hash, charge the registration fee (as today), THEN transfer `stake_lamports` from the owner to the `agent_record` account using a System transfer CPI, then fill the record with `record.stake_lamports = stake_lamports`.

### 2. top_up_stake.rs (new)
- Accounts: `owner` (Signer, mut), `agent_record` (mut, seeds, `has_one = owner @ NotOwner`, status must be Active else `NameRevoked`), `system_program`.
- Arg: `amount: u64` (must be > 0, else `StakeBelowMinimum`). Reject if `unstake_requested_at != 0` with `UnstakeAlreadyRequested`.
- System transfer owner -> record, then `stake_lamports += amount` (checked add, `MathOverflow`). Emit `StakeAdded`.

### 3. request_unstake.rs (new)
- Accounts: `owner` (Signer), `agent_record` (mut, seeds, `has_one = owner`). Works for Active and Revoked names.
- Require `stake_lamports > 0` (else `NoStakeToWithdraw`) and `unstake_requested_at == 0` (else `UnstakeAlreadyRequested`).
- Set `unstake_requested_at = now`. Emit `UnstakeRequested { available_at: now + config.unstake_cooldown_secs }`. Needs the `config` account too.

### 4. withdraw_stake.rs (new)
- Accounts: `owner` (Signer, mut), `config`, `agent_record` (mut, seeds, `has_one = owner`).
- Require `unstake_requested_at != 0` (else `UnstakeNotRequested`) and `now >= unstake_requested_at + cooldown` (else `CooldownNotFinished`). Require `stake_lamports > 0` (else `NoStakeToWithdraw`).
- Check the rent invariant, then `record.sub_lamports(amount)` and `owner.add_lamports(amount)` where `amount = stake_lamports`. Set `stake_lamports = 0`, `unstake_requested_at = 0`. Emit `StakeWithdrawn`.

### 5. report_challenge.rs (new)
- Accounts: `verifier` (Signer), `config`, `treasury` (`#[account(mut, dup, address = config.treasury @ InvalidTreasury)]`, a `SystemAccount`), `agent_record` (mut, seeds). Works for Active and Revoked names.
- Require the verifier is in `config.verifiers`, else `NotAVerifier`.
- Arg: `passed: bool`.
- Pass: `passes += 1` (use `saturating_add`).
- Fail: `fails += 1`; set `endpoint_verified = false`; compute the slash (see decision 4); check the rent invariant; move lamports record -> treasury with `sub_lamports` / `add_lamports`; `stake_lamports -= slash`.
- Emit `ChallengeReported` with the slashed amount (0 on pass).

### 6. mark_endpoint_verified.rs (new)
- Accounts: `verifier` (Signer), `config`, `agent_record` (mut, seeds, status must be Active).
- Require the verifier is in `config.verifiers`. Set `endpoint_verified = true`. Emit `EndpointVerified`.
- Comment clearly: the verifier is expected to have checked off-chain that the agent signed a random challenge with its `agent_pubkey` BEFORE calling this.

### 7. set_verifiers.rs (new)
- Accounts: `admin` (Signer), `config` (mut, seeds, `has_one = admin @ Unauthorized`).
- Arg: `verifiers: Vec<Pubkey>`. Reject more than `MAX_VERIFIERS` (`TooManyVerifiers`) and duplicates (`DuplicateVerifier`). Replace the whole list. Emit `VerifiersUpdated`.

### 8. revoke_name.rs (modify)
- Needs the `config` account for the cooldown only if you emit `available_at`; otherwise keep it simple: after setting Revoked, if `stake_lamports > 0 && unstake_requested_at == 0` set `unstake_requested_at = now`. Also set `endpoint_verified = false`. If you add the `config` account, add it as the LAST account and update the tests.

### 9. update_endpoint.rs (modify)
- Set `endpoint_verified = false` on every successful update (the endpoint or key may have changed, so it must be re-verified).

### 10. mod.rs and lib.rs
- Add the new `pub mod` / `pub use` lines and the new instruction wrappers ONLY under the "Phase 2" marker comments. Keep the marker comments and the blank lines around them.

### 11. tests/helpers.ts and tests/agentns.ts
- In `registerName(owner, opts)` add option `stakeLamports` (default `TEST_CONFIG.minStake`) and pass it as the last arg. Export `MIN_STAKE = TEST_CONFIG.minStake`.
- In `agentns.ts`: the assertion that `stakeLamports` is 0 now expects `MIN_STAKE`; increase airdrops (each registration now locks 0.1 SOL). Nothing else.

### 12. tests/phase2-trust.ts (new)
Use agent ids that start with `p2-`. Start with `await ensureConfig()`, create a funded `verifier` keypair and call `setVerifiers([verifier.publicKey])` as admin in a `before` block. Write these tests (one `it` each, each with a comment explaining what and why):

1. Registering below the minimum stake fails with `StakeBelowMinimum`.
2. Registering with the minimum stake stores `stakeLamports` and the record account balance equals rent-exempt minimum + stake.
3. `topUpStake` adds stake; a non-owner cannot top up (`NotOwner`).
4. `setVerifiers`: admin can set; non-admin fails (`Unauthorized`); more than 8 fails (`TooManyVerifiers`); duplicates fail (`DuplicateVerifier`).
5. A non-verifier cannot call `reportChallenge` (`NotAVerifier`).
6. A passed challenge increments `passes` and slashes nothing.
7. A failed challenge increments `fails`, moves exactly `stake * slashBps / 10000` to the treasury (check the treasury balance delta AND the record balance drop AND the new `stakeLamports`), and clears `endpointVerified`.
8. `markEndpointVerified` by a verifier sets the flag; `updateEndpoint` by the owner clears it.
9. Unstake flow: withdraw before requesting fails (`UnstakeNotRequested`); after `requestUnstake`, withdraw before the cooldown fails (`CooldownNotFinished`); after `sleep(cooldownSecs * 1000 + 1500)` withdraw succeeds, the owner balance goes up by the stake, `stakeLamports` is 0; requesting again with zero stake fails (`NoStakeToWithdraw`).
10. Revoking a name with stake starts the cooldown automatically; a verifier can still slash the revoked name during the cooldown; after the cooldown the owner can withdraw what is left.
11. Rent invariant: after a slash and after a withdraw the record balance is still >= `getMinimumBalanceForRentExemption(accountDataLength)`.

## Commit message
`feat(phase2): stake, unstake cooldown, verifiers, challenge slashing, endpoint verified flag`