/**
 * Program constants, mirroring `programs/agentns/src/constants.rs` and `state.rs`.
 *
 * These are duplicated on purpose: the on-chain program is the source of truth and
 * the frontend must never import from it at build time (the Rust crate is not
 * consumable by Vite). Keeping them in one file makes drift easy to spot.
 */

/** Matches `declare_id!` in programs/agentns/src/lib.rs. */
export const PROGRAM_ID =
  "3CZ5JZgJdxX2wt8UbmyP9kkHPmiMnHhnbsUAXWj7XdnD" as const;

/** PDA seed for the singleton registry config account. */
export const CONFIG_SEED = new TextEncoder().encode("config");

/** PDA seed for an agent record, used together with the 32-byte name hash. */
export const AGENT_SEED = new TextEncoder().encode("agent");

/** Anchor accounts carry an 8-byte discriminator before the struct body. */
export const ANCHOR_DISCRIMINATOR_BYTES = 8;

/** agent_id, capability and provider: 1..=32 chars of [a-z0-9-]. */
export const MAX_PART_LEN = 32;
export const MAX_VERSION_LEN = 16;
export const MAX_NAME_LEN = 128;
export const MAX_ENDPOINT_LEN = 200;
export const MAX_URI_LEN = 200;
/** The registry caps the verifier list at 8 via `#[max_len(MAX_VERIFIERS)]`. */
export const MAX_VERIFIERS = 8;

/** The protocol prefix of a name, in the order Anchor serialises the enum. */
export const PROTOCOLS = ["a2a", "mcp", "acp"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

/**
 * Anchor serialises a unit-variant enum as its u8 index. The declaration order in
 * `state.rs` is `A2a, Mcp, Acp`, so those indices are 0, 1 and 2 respectively.
 */
export const PROTOCOL_INDEX: Record<Protocol, number> = {
  a2a: 0,
  mcp: 1,
  acp: 2,
};

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  a2a: "A2A",
  mcp: "MCP",
  acp: "ACP",
};

/** `AgentStatus` is `Active, Revoked` in `state.rs`. */
export const AGENT_STATUS = ["active", "revoked"] as const;
export type AgentStatus = (typeof AGENT_STATUS)[number];

export const AGENT_STATUS_INDEX: Record<AgentStatus, number> = {
  active: 0,
  revoked: 1,
};

/** The full immutable name for an agent, as `utils::build_name` composes it. */
export function buildName(
  protocol: Protocol,
  agentId: string,
  capability: string,
  provider: string,
  version: string,
): string {
  return `${protocol}://${agentId}.${capability}.${provider}.v${version}`;
}
