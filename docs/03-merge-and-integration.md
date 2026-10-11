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

# Prompt 03 - Merge check and cross-feature tests (run on branch `main` AFTER both merges)

Prerequisite: `phase2-trust` and `phase3-marketplace` are both merged into `main`.

## Goal

1. Make sure the merged code compiles and all tests pass.
2. Add tests for the places where Phase 2 (stake) and Phase 3 (marketplace) meet.

## If there were merge conflicts

Conflicts can only be in `instructions/mod.rs` and `lib.rs`, inside the marker sections. Resolution rule: KEEP BOTH sides, delete the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), keep the Phase 2 and Phase 3 marker comments, and keep the section order Phase 1, Phase 2, Phase 3.

## Files you may change

- Fix-ups ONLY if the merge broke something (tell me exactly what you fixed and why).
- NEW: `tests/integration-stake-market.ts`

## Tasks: tests/integration-stake-market.ts (agent ids start with `int-`)

Start with `await ensureConfig()`. Set the verifier list as in `phase2-trust.ts` (you can call `setVerifiers` with a fresh funded verifier; if the list is shared, include both verifiers by reading the current config first, or just reuse the same pattern from that file). Register names ONLY through `registerName` from helpers (it now includes the stake). Tests, one `it` each, each with a comment explaining what and why:

1. A name cannot be listed after `requestUnstake` (`UnstakePending`).
2. If the owner lists a name and THEN requests unstake, `buyName` fails (`UnstakePending`), and the seller can still cancel.
3. The stake moves with the name: after `buyName`, the record's `stakeLamports` is unchanged, the record balance is unchanged, the new owner can `requestUnstake` and (after the cooldown) `withdrawStake`, and the old owner cannot (`NotOwner`).
4. Reputation moves with the name: pass and fail counters are unchanged after a sale, and `endpointVerified` is false after a sale even if it was true before.
5. A revoked name cannot be listed (`NameRevoked`).
6. A failed challenge on a listed name reduces the stake, and the buyer then owns the name with the reduced stake (shows the buyer must read the stake before buying).

## Commit message
`test: integration tests for stake and marketplace together`