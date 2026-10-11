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

# Prompt 02 - Phase 3: Marketplace (run on branch `phase3-marketplace`)

Prerequisite: prompt 00 (shared base) is already committed on `main`, and this branch was created from `main` (NOT from `phase2-trust`). Config field `marketplace_fee_bps`, record fields `unstake_requested_at` and `endpoint_verified`, the error variants (`InvalidPrice`, `ListingStale`, `PriceAboveMax`, `UnstakePending`, `CannotBuyOwnName`, `ListingMismatch`) and the events (`NameListed`, `ListingCancelled`, `NameSold`) already exist. Do not re-create them.

## Goal

Let a name owner list a name at a fixed price and let anyone buy it in ONE transaction: buyer pays, seller is paid, platform fee goes to the treasury, and ownership moves to the buyer.

## Design decisions (follow exactly)

1. This branch must NOT depend on Phase 2 code. Stake (added in Phase 2) lives inside the `AgentRecord` account's own lamports, so it automatically moves with the name when `record.owner` changes. You do not need any stake code here.
2. Listing price is fixed. To change the price the seller cancels and lists again. To protect the buyer, `buy_name` takes `max_price_lamports` and fails with `PriceAboveMax` if the listing costs more.
3. A name cannot be listed, and cannot be bought, while `unstake_requested_at != 0` (error `UnstakePending`). Why: otherwise a buyer could pay for a name whose stake is about to be withdrawn. In this branch nothing sets that field yet (Phase 2 does), so it is always 0 here, but the check must exist.
4. A listing becomes stale if the name changed owner after it was listed (for example via `transfer_name`). `buy_name` must check `listing.seller == agent_record.owner` and fail with `ListingStale` otherwise.
5. After a sale, set `endpoint_verified = false` (the new owner must get the endpoint verified again).
6. Fee = `price * marketplace_fee_bps / 10_000`, computed with `u128` math and rounded down. Seller gets `price - fee`. So `fee + seller_amount == price` always.

## Files you may change

- `programs/agentns/src/state.rs` (ONLY append the `Listing` struct at the very bottom)
- NEW in `programs/agentns/src/instructions/`: `list_name.rs`, `cancel_listing.rs`, `buy_name.rs`
- `instructions/mod.rs` and `lib.rs` (add lines ONLY under the "Phase 3" marker comments, never anywhere else)
- NEW: `tests/phase3-marketplace.ts`

Do NOT touch `register_name.rs`, `update_endpoint.rs`, `revoke_name.rs`, `transfer_name.rs`, `initialize_config.rs`, `update_config.rs`, `errors.rs`, `events.rs`, `constants.rs`, `tests/helpers.ts`, `tests/agentns.ts`. (Phase 2 changes some of those on another branch. Leaving them alone is what keeps the merge clean.)

## Tasks

### 1. state.rs (append at the bottom)
```rust
/// An offer to sell one agent name at a fixed price. PDA: ["listing", agent_record].
#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,
    pub agent_record: Pubkey,
    pub price_lamports: u64,
    pub created_at: i64,
    pub bump: u8,
}
```
Add a doc comment on every field.

### 2. list_name.rs (new)
- Accounts: `owner` (Signer, mut, pays the listing rent), `agent_record` (seeds `[AGENT_SEED, name_hash]`, bump, `has_one = owner @ NotOwner`, status Active else `NameRevoked`, `unstake_requested_at == 0` else `UnstakePending`), `listing` (`init`, payer owner, space `8 + Listing::INIT_SPACE`, seeds `[LISTING_SEED, agent_record.key().as_ref()]`, bump), `system_program`.
- Arg: `price_lamports: u64`, must be > 0 else `InvalidPrice`.
- Fill the listing, emit `NameListed`. A second listing for the same name fails because the account already exists.

### 3. cancel_listing.rs (new)
- Accounts: `seller` (Signer, mut), `agent_record` (the record for the name), `listing` (mut, seeds, bump = listing.bump, `has_one = seller`, `close = seller`, and a constraint `listing.agent_record == agent_record.key()` else `ListingMismatch`).
- Cancelling must work even if the name was revoked or changed owner (so the seller can always get the listing rent back). So do NOT require the seller to still be the record owner.
- Emit `ListingCancelled`.

### 4. buy_name.rs (new)
- Accounts: `buyer` (Signer, mut), `config` (seeds), `treasury` (`#[account(mut, dup, address = config.treasury @ InvalidTreasury)]`, `SystemAccount`), `seller` (`#[account(mut, dup, address = listing.seller)]`, `SystemAccount`), `agent_record` (mut, seeds), `listing` (mut, seeds `[LISTING_SEED, agent_record.key()]`, bump = listing.bump, `close = seller`, constraint `listing.agent_record == agent_record.key()` else `ListingMismatch`), `system_program`.
- Arg: `max_price_lamports: u64`.
- Checks, in this order: record status Active (`NameRevoked`); `listing.seller == agent_record.owner` (`ListingStale`); `buyer != seller` (`CannotBuyOwnName`); `unstake_requested_at == 0` (`UnstakePending`); `listing.price_lamports <= max_price_lamports` (`PriceAboveMax`).
- Money: compute `fee` and `seller_amount` (decision 6). If `fee > 0`: System transfer buyer -> treasury. System transfer buyer -> seller for `seller_amount`.
- Then: `record.owner = buyer`, `record.updated_at = now`, `record.endpoint_verified = false`. The listing account is closed automatically (`close = seller` refunds the rent to the seller).
- Emit `NameSold`.

### 5. mod.rs and lib.rs
Add the new `pub mod` / `pub use` lines and the three instruction wrappers ONLY under the "Phase 3" marker comments. Keep the marker comments and blank lines.

### 6. tests/phase3-marketplace.ts (new)
Use agent ids that start with `p3-`. Import everything from `./helpers` and register names ONLY through `registerName` from helpers. Start with `await ensureConfig()`. Create funded `seller` and `buyer` keypairs. Measure balances as DELTAS (other tests also touch the treasury). Tests (one `it` each, each with a comment explaining what and why):

1. `listName` creates a listing with the right seller, record and price.
2. Price 0 is rejected (`InvalidPrice`).
3. A non-owner cannot list (`NotOwner`).
4. Listing the same name twice fails (account already in use).
5. `cancelListing` by the seller closes the listing account (fetching it fails) and a non-seller cannot cancel.
6. `buyName` happy path: ownership moves to the buyer; the listing is closed; the treasury gets exactly `fee`; the seller gets `price - fee` plus the listing rent refund; the buyer pays `price` (plus the transaction fee, so allow for it).
7. Fee math with an odd price (for example 1_000_001 lamports): `fee + sellerAmount == price` and the fee is rounded down.
8. `buyName` fails when `max_price_lamports` is below the price (`PriceAboveMax`).
9. A seller cannot buy their own listing (`CannotBuyOwnName`).
10. Stale listing: after listing, the seller calls `transferName` to a third wallet; `buyName` now fails (`ListingStale`); the seller can still `cancelListing` to get the rent back.
11. Revoked after listing: the owner revokes the name; `buyName` fails (`NameRevoked`); the seller can still cancel.
12. After a sale the new owner can `updateEndpoint` and the old owner cannot (`NotOwner`).

## Commit message
`feat(phase3): marketplace - list, cancel, buy with fee and stale-listing protection`