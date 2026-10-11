/** Presentation helpers. Pure formatting — nothing here reads the chain. */

const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/**
 * Formats lamports as SOL. `maximumFractionDigits` is fixed per magnitude so the
 * value never jitters in width as a balance ticks.
 */
export function formatSol(
  lamports: bigint,
  options?: { maximumFractionDigits?: number },
): string {
  const sol = lamportsToSol(lamports);
  const abs = Math.abs(sol);
  const maximumFractionDigits =
    options?.maximumFractionDigits ??
    (abs >= 1000 ? 2 : abs >= 1 ? 4 : abs > 0 ? 6 : 0);
  return `${sol.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })} SOL`;
}

/** Parses a user-typed SOL amount into lamports. Returns null when unparseable. */
export function parseSol(input: string): bigint | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === ".") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  // Scale to 9 decimals through a string so we do not lose precision to float math.
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const padded = `${fraction}${"0".repeat(9 - fraction.length)}`.slice(0, 9);
  return (
    BigInt(whole || "0") * BigInt(LAMPORTS_PER_SOL) + BigInt(padded || "0")
  );
}

/** `1234 -> "12.34%"` for basis-point values. */
export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString(undefined, {
    minimumFractionDigits: bps % 100 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  })}%`;
}

/** `90061 -> "1d 1h"` for cooldown seconds. */
export function formatDuration(seconds: bigint): string {
  const total = Number(seconds);
  if (total <= 0) return "None";
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(" ");
}

/** `4C7v...9xQd` — the middle-elided form used for addresses everywhere. */
export function shortenAddress(value: string, lead = 4, tail = 4): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** Unix seconds -> a short absolute timestamp. */
export function formatTimestamp(unixSeconds: bigint): string {
  if (unixSeconds <= 0n) return "—";
  return new Date(Number(unixSeconds) * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Milliseconds -> "just now" / "4m ago" / "3d ago". */
export function formatRelative(unixSeconds: bigint): string {
  if (unixSeconds <= 0n) return "—";
  const deltaSeconds = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (deltaSeconds < 0) return "in the future";
  if (deltaSeconds < 60) return "just now";
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Base58-ish → hex, for showing the 32-byte name hash next to a record. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
