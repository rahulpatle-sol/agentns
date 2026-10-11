# AgentNS - Phase 1 Registry

An on-chain name registry for AI agents built with Anchor.

## Project Structure

```
agentns/
├── programs/agentns/     # Anchor program source code
├── tests/                # TypeScript test files
├── target/               # Compiled artifacts
└── Anchor.toml           # Anchor configuration
```

## Getting Started

### Prerequisites

- Anchor CLI 1.2.1
- Solana CLI 3.1.10
- Rust 1.98
- Node 24
- Yarn

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build the program:
   ```bash
   anchor build
   ```

3. Run tests:
   ```bash
   anchor test
   ```

### Running the Tests

The test suite includes 14 tests for Phase 1 registry functionality:

1. Initializes the registry config
2. Lets the admin rotate the resolver key
3. Rejects config updates from a non-admin
4. Registers a name and charges the fee
5. Rejects a duplicate name
6. Rejects a name_hash that does not match the name
7. Rejects a non-https endpoint
8. Rejects an invalid name part (uppercase)
9. Rejects an invalid version
10. Lets the owner update the endpoint
11. Rejects endpoint updates from a non-owner
12. Transfers a name to a new owner
13. Rejects transferring to the same owner
14. Revokes a name and keeps it reserved

## Phase 2: Trust / Stake

To run Phase 2 tests on a separate branch:

```bash
git checkout main
git checkout -b phase2-trust
# Run Phase 2 implementation
```

Phase 2 adds:
- Stake mechanism (agents lock SOL behind their name)
- Verifier system for challenge reporting
- Cooldown periods for unstaking
- Challenge slashing mechanism
- Endpoint verified flag

## Phase 3: Marketplace

To run Phase 3 tests on a separate branch:

```bash
git checkout main
git checkout -b phase3-marketplace
# Run Phase 3 implementation
```

Phase 3 adds:
- Name listing at fixed prices
- Buy names in one transaction
- Platform fees going to treasury
- Stale listing protection
- Cancel listing functionality

## Git Workflow

```bash
# Step 0 - on main
git branch -M main
git add docs && git commit -m "docs: agent prompts"

# Step 1 - Phase 2
git checkout main
git checkout -b phase2-trust
# Implement and commit Phase 2 changes

# Step 2 - Phase 3
git checkout main
git checkout -b phase3-marketplace
# Implement and commit Phase 3 changes

# Step 3 - merge
git checkout main
git merge --no-ff phase2-trust
git merge --no-ff phase3-marketplace
```

## Commit Messages

- Phase 2: `feat(phase2): stake, unstake cooldown, verifiers, challenge slashing, endpoint verified flag`
- Phase 3: `feat(phase3): marketplace - list, cancel, buy with fee and stale-listing protection`
- Shared base: `chore: shared base for phase 2 and phase 3 (config fields, errors, events, test helpers)`