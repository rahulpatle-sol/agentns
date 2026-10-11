/**
 * AgentNS program client: account decoding, PDA derivation and instruction
 * builders. Everything here is hand-written against the Rust source so the UI
 * talks to the real program with no codegen step and no mock data.
 *
 * Mirrors:
 *   programs/agentns/src/state.rs           (RegistryConfig, AgentRecord)
 *   programs/agentns/src/lib.rs             (instruction signatures)
 *   programs/agentns/src/instructions/*.rs  (account ordering)
 */

import {
  address,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";
import { AccountRole, type Instruction } from "@solana/instructions";

import { BorshReader, BorshWriter } from "./borsh";
import {
  AGENT_SEED,
  AGENT_STATUS,
  AGENT_STATUS_INDEX,
  CONFIG_SEED,
  MAX_VERIFIERS,
  PROTOCOL_INDEX,
  PROGRAM_ID,
  type AgentStatus,
  type Protocol,
} from "./constants";

/* -------------------------------------------------------------------------- */
/* SHA-256                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Anchor derives an instruction's 8-byte discriminator from
 * `sha256("global:" + snake_case_instruction_name)` and the name hash from a
 * plain `sha256` of the full name. Web Crypto is the only SHA-256 available in
 * the browser, and it is async — so these helpers are too.
 */
export async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    input as unknown as BufferSource,
  );
  return new Uint8Array(digest);
}

/** First 8 bytes of `sha256("global:<snake_case_name>")`, per the Anchor spec. */
async function instructionDiscriminator(
  snakeCaseName: string,
): Promise<Uint8Array> {
  const prefixed = new TextEncoder().encode(`global:${snakeCaseName}`);
  return (await sha256(prefixed)).slice(0, 8);
}

/** SHA-256 of the full agent name — the same bytes the program re-checks. */
export async function hashName(fullName: string): Promise<Uint8Array> {
  return sha256(new TextEncoder().encode(fullName));
}

/* -------------------------------------------------------------------------- */
/* Accounts                                                                    */
/* -------------------------------------------------------------------------- */

/** Decoded `state.rs::RegistryConfig`. */
export type RegistryConfig = {
  admin: Address;
  treasury: Address;
  resolverPubkey: Address;
  registrationFeeLamports: bigint;
  minStakeLamports: bigint;
  slashBps: number;
  unstakeCooldownSecs: bigint;
  marketplaceFeeBps: number;
  verifiers: Address[];
  bump: number;
};

/** Decoded `state.rs::AgentRecord`. */
export type AgentRecord = {
  owner: Address;
  nameHash: Uint8Array;
  protocol: Protocol;
  name: string;
  agentId: string;
  capability: string;
  provider: string;
  version: string;
  endpoint: string;
  agentPubkey: Address;
  metadataUri: string;
  status: AgentStatus;
  registeredAt: bigint;
  updatedAt: bigint;
  stakeLamports: bigint;
  passes: number;
  fails: number;
  unstakeRequestedAt: bigint;
  endpointVerified: boolean;
  bump: number;
};

const PROTOCOLS_BY_INDEX: Protocol[] = ["a2a", "mcp", "acp"];
const STATUS_BY_INDEX: readonly AgentStatus[] = AGENT_STATUS;

/**
 * Reads a base64 account payload into `RegistryConfig`.
 *
 * On-chain data is untrusted input, so this walks the fields in strict struct
 * order and throws on a short buffer rather than returning silently wrong values.
 */
export function decodeRegistryConfig(base64: string): RegistryConfig {
  const reader = new BorshReader(base64ToBytes(base64));
  reader.bytes(8); // Anchor discriminator: a version guard, not a field we read.

  const config: RegistryConfig = {
    admin: readAddress(reader),
    treasury: readAddress(reader),
    resolverPubkey: readAddress(reader),
    registrationFeeLamports: reader.u64(),
    minStakeLamports: reader.u64(),
    slashBps: reader.u16(),
    unstakeCooldownSecs: reader.i64(),
    marketplaceFeeBps: reader.u16(),
    verifiers: reader.vec(readAddress),
    bump: reader.u8(),
  };

  // The program caps verifiers with `#[max_len(MAX_VERIFIERS)]`. A longer list
  // means the account does not match the layout we expect.
  if (config.verifiers.length > MAX_VERIFIERS) {
    throw new Error(
      `Registry config reports ${config.verifiers.length} verifiers, which exceeds the expected maximum of ${MAX_VERIFIERS}.`,
    );
  }
  return config;
}

/** Reads a base64 account payload into `AgentRecord`, in `state.rs` field order. */
export function decodeAgentRecord(base64: string): AgentRecord {
  const reader = new BorshReader(base64ToBytes(base64));
  reader.bytes(8); // Anchor discriminator.

  const owner = readAddress(reader);
  const nameHash = reader.bytes(32);
  const protocolIndex = reader.u8();
  const protocol = PROTOCOLS_BY_INDEX[protocolIndex];
  const name = reader.string();
  const agentId = reader.string();
  const capability = reader.string();
  const provider = reader.string();
  const version = reader.string();
  const endpoint = reader.string();
  const agentPubkey = readAddress(reader);
  const metadataUri = reader.string();
  const statusIndex = reader.u8();
  const registeredAt = reader.i64();
  const updatedAt = reader.i64();
  const stakeLamports = reader.u64();
  const passes = reader.u32();
  const fails = reader.u32();
  const unstakeRequestedAt = reader.i64();
  const endpointVerified = reader.bool();
  const bump = reader.u8();

  return {
    owner,
    nameHash,
    protocol: protocol ?? "mcp",
    name,
    agentId,
    capability,
    provider,
    version,
    endpoint,
    agentPubkey,
    metadataUri,
    status: STATUS_BY_INDEX[statusIndex] ?? "active",
    registeredAt,
    updatedAt,
    stakeLamports,
    passes,
    fails,
    unstakeRequestedAt,
    endpointVerified,
    bump,
  };
}

/* -------------------------------------------------------------------------- */
/* Program-derived addresses                                                   */
/* -------------------------------------------------------------------------- */

/** The AgentNS program address, typed for Kit. */
export const programAddress: Address = address(PROGRAM_ID);

/** The singleton registry config PDA: seeds `["config"]`. */
export async function configPda(
  programId: Address = programAddress,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: [CONFIG_SEED],
  });
  return pda;
}

/** An agent record PDA: seeds `["agent", name_hash]`. */
export async function agentPda(
  nameHash: Uint8Array,
  programId: Address = programAddress,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: [AGENT_SEED, nameHash],
  });
  return pda;
}

/** Resolves a full name string to its record PDA in one step. */
export async function agentPdaForName(
  fullName: string,
  programId: Address = programAddress,
): Promise<Address> {
  return agentPda(await hashName(fullName), programId);
}

/* -------------------------------------------------------------------------- */
/* Instructions                                                                */
/* -------------------------------------------------------------------------- */

/** Arguments for `register_name`, matching the handler in lib.rs exactly. */
export type RegisterNameInput = {
  nameHash: Uint8Array;
  protocol: Protocol;
  agentId: string;
  capability: string;
  provider: string;
  version: string;
  endpoint: string;
  agentPubkey: Address;
  metadataUri: string;
  stakeLamports: bigint;
};

/** Accounts `register_name` needs, in the order declared in the Rust struct. */
export type RegisterNameAccounts = {
  owner: Address;
  config: Address;
  treasury: Address;
  agentRecord: Address;
};

/**
 * Builds `register_name`.
 *
 * Account order follows `instructions/register_name.rs`: owner, config, treasury,
 * agent_record, system_program.
 */
export async function getRegisterNameInstruction(
  input: RegisterNameInput,
  accounts: RegisterNameAccounts,
  programId: Address = programAddress,
): Promise<Instruction> {
  const data = new BorshWriter()
    .raw(await instructionDiscriminator("register_name"))
    .bytes(input.nameHash)
    .u8(PROTOCOL_INDEX[input.protocol])
    .string(input.agentId)
    .string(input.capability)
    .string(input.provider)
    .string(input.version)
    .string(input.endpoint)
    .raw(getAddressEncoder().encode(input.agentPubkey))
    .string(input.metadataUri)
    .u64(input.stakeLamports)
    .toBytes();

  return {
    programAddress: programId,
    accounts: [
      { address: accounts.owner, role: AccountRole.WRITABLE_SIGNER },
      { address: accounts.config, role: AccountRole.READONLY },
      { address: accounts.treasury, role: AccountRole.WRITABLE },
      { address: accounts.agentRecord, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data,
  };
}

/** Accounts `update_endpoint` needs. */
export type OwnerRecordAccounts = {
  owner: Address;
  agentRecord: Address;
};

/**
 * Builds `update_endpoint`.
 *
 * The program re-derives the record PDA from `agent_record.name_hash`, so the
 * caller must pass the record it just decoded rather than an address it invented.
 */
export async function getUpdateEndpointInstruction(
  args: { endpoint: string; agentPubkey: Address; metadataUri: string },
  accounts: OwnerRecordAccounts,
  programId: Address = programAddress,
): Promise<Instruction> {
  const data = new BorshWriter()
    .raw(await instructionDiscriminator("update_endpoint"))
    .string(args.endpoint)
    .raw(getAddressEncoder().encode(args.agentPubkey))
    .string(args.metadataUri)
    .toBytes();

  return {
    programAddress: programId,
    accounts: [
      { address: accounts.owner, role: AccountRole.READONLY_SIGNER },
      { address: accounts.agentRecord, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/** Builds `transfer_name`. Account order: owner, agent_record. */
export async function getTransferNameInstruction(
  newOwner: Address,
  accounts: OwnerRecordAccounts,
  programId: Address = programAddress,
): Promise<Instruction> {
  const data = new BorshWriter()
    .raw(await instructionDiscriminator("transfer_name"))
    .raw(getAddressEncoder().encode(newOwner))
    .toBytes();

  return {
    programAddress: programId,
    accounts: [
      { address: accounts.owner, role: AccountRole.READONLY_SIGNER },
      { address: accounts.agentRecord, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/** Builds `revoke_name`. Takes no arguments; the record must still be active. */
export async function getRevokeNameInstruction(
  accounts: OwnerRecordAccounts,
  programId: Address = programAddress,
): Promise<Instruction> {
  const data = new BorshWriter()
    .raw(await instructionDiscriminator("revoke_name"))
    .toBytes();

  return {
    programAddress: programId,
    accounts: [
      { address: accounts.owner, role: AccountRole.READONLY_SIGNER },
      { address: accounts.agentRecord, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/** Maps `AgentStatus` to the discriminant the program compares against. */
export const agentStatusIndex = (status: AgentStatus): number =>
  AGENT_STATUS_INDEX[status];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** `11111111111111111111111111111111`. */
const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");

/** Reads one 32-byte public key off the wire and converts it to an `Address`. */
function readAddress(reader: BorshReader): Address {
  return address(getAddressDecoder().decode(reader.bytes(32) as never));
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
}
