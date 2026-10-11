/**
 * Program error mapping.
 *
 * Anchor's `#[error_code]` assigns each variant a number starting at 6000 in
 * declaration order. Turning those numbers into the same sentences the Rust
 * `#[msg(...)]` strings use means the UI never shows a bare "custom program
 * error: 6006" at the user.
 */

import type { AgentNsError } from "../../program/errors";

/** 6000 + declaration index in `programs/agentns/src/errors.rs`. */
const ERROR_CODES: Record<number, AgentNsError> = {
  6000: { name: "Unauthorized", message: "Only the admin can do this." },
  6001: {
    name: "NotOwner",
    message: "Only the owner of this name can do this.",
  },
  6002: {
    name: "InvalidNamePart",
    message:
      'Name parts must be 1–32 characters of a-z, 0–9 or "-", and cannot start or end with "-".',
  },
  6003: {
    name: "InvalidVersion",
    message: "Version must look like 1.0 or 1.2.3.",
  },
  6004: {
    name: "InvalidEndpoint",
    message: "Endpoint must start with https:// and be at most 200 characters.",
  },
  6005: {
    name: "InvalidMetadataUri",
    message: "Metadata URI must be at most 200 characters.",
  },
  6006: {
    name: "NameHashMismatch",
    message: "The name hash does not match the SHA-256 of the full name.",
  },
  6007: { name: "NameRevoked", message: "This name has been revoked." },
  6008: {
    name: "SameOwner",
    message: "The new owner must be a different wallet.",
  },
  6009: {
    name: "InvalidTreasury",
    message: "Treasury account does not match the registry config.",
  },
  6010: {
    name: "InvalidBps",
    message: "Basis points value exceeds the maximum allowed.",
  },
  6011: { name: "InvalidCooldown", message: "Cooldown must be non-negative." },
  6012: { name: "MathOverflow", message: "Arithmetic overflow." },
  6013: {
    name: "StakeBelowMinimum",
    message: "Stake is below the minimum required.",
  },
  6014: {
    name: "NotAVerifier",
    message: "Signer is not an authorized verifier.",
  },
  6015: { name: "TooManyVerifiers", message: "Too many verifiers (max 8)." },
  6016: { name: "DuplicateVerifier", message: "Duplicate verifier in list." },
  6017: { name: "NoStakeToWithdraw", message: "No stake to withdraw." },
  6018: { name: "UnstakeNotRequested", message: "Unstake was not requested." },
  6019: {
    name: "UnstakeAlreadyRequested",
    message: "Unstake is already requested.",
  },
  6020: {
    name: "CooldownNotFinished",
    message: "The cooldown period has not finished.",
  },
  6021: {
    name: "StakeInvariantBroken",
    message: "The stake invariant would be broken.",
  },
  6022: { name: "InvalidPrice", message: "Price must be greater than zero." },
  6023: { name: "ListingStale", message: "Listing is stale (owner changed)." },
  6024: {
    name: "PriceAboveMax",
    message: "Price exceeds the maximum allowed.",
  },
  6025: {
    name: "UnstakePending",
    message: "Unstake is pending; this name cannot be listed or bought.",
  },
  6026: {
    name: "CannotBuyOwnName",
    message: "You cannot buy your own listing.",
  },
  6027: {
    name: "ListingMismatch",
    message: "Listing does not match the agent record.",
  },
};

export type TransactionFailure = {
  /** Short label for a toast title. */
  title: string;
  /** One or two sentences the user can act on. */
  message: string;
  /** True when the wallet itself refused to sign — not a chain failure. */
  isUserRejection: boolean;
  /** True when the failure came from the program, not the transport. */
  isProgramError: boolean;
  /** Explorer link, when a signature exists. */
  signature?: string;
};

/** True when the user dismissed the wallet's approval sheet. */
function isRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /reject|declin|cancel|denied|user (cancell|abort)/i.test(message);
}

function isInsufficientFunds(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /insufficient|not enough SOL|InsufficientFunds/i.test(message);
}

/** Digs the numeric Anchor error out of whatever shape the RPC layer produced. */
function extractCustomErrorCode(error: unknown): number | null {
  const seen = new Set<unknown>();
  let current: unknown = error;

  // Walk the `cause` chain; Kit nests the raw JSON-RPC error underneath.
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?: unknown; cause?: unknown };
    if (
      typeof candidate.code === "number" &&
      candidate.code >= 6000 &&
      candidate.code < 7000
    ) {
      return candidate.code;
    }
    const data = (current as { data?: unknown }).data;
    if (typeof data === "object" && data !== null) {
      const err = (data as { err?: unknown }).err;
      if (typeof err === "object" && err !== null) {
        const code = (err as { code?: unknown }).code;
        if (typeof code === "number") {
          if (code >= 6000 && code < 7000) return code;
          // A non-Anchor custom code is still worth surfacing verbatim.
          return code;
        }
      }
    }
    current = candidate.cause;
  }
  return null;
}

function extractSignature(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const signature = (current as { signature?: unknown }).signature;
    if (typeof signature === "string") return signature;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Converts anything thrown during a send into a message worth showing. */
export function describeTransactionError(
  error: unknown,
  action = "This transaction",
): TransactionFailure {
  const signature = extractSignature(error);
  const code = extractCustomErrorCode(error);
  const known = code !== null ? ERROR_CODES[code] : undefined;

  if (known) {
    return {
      title: `${known.name} (error ${code})`,
      message: known.message,
      isUserRejection: false,
      isProgramError: true,
      signature,
    };
  }

  if (isRejection(error)) {
    return {
      title: "Signature declined",
      message: "You cancelled the request in your wallet. Nothing was sent.",
      isUserRejection: true,
      isProgramError: false,
      signature,
    };
  }

  if (isInsufficientFunds(error)) {
    return {
      title: "Insufficient SOL",
      message:
        "This wallet does not have enough SOL to cover the stake, the registration fee and the network fee. Add SOL and try again.",
      isUserRejection: false,
      isProgramError: false,
      signature,
    };
  }

  if (code !== null) {
    return {
      title: `Transaction failed (error ${code})`,
      message: `${action} was rejected by the program with custom error code ${code}.`,
      isUserRejection: false,
      isProgramError: true,
      signature,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    title: "Transaction failed",
    message: `${action} could not be completed. ${message}`,
    isUserRejection: false,
    isProgramError: false,
    signature,
  };
}
