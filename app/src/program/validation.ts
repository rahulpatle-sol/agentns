/**
 * Client-side mirrors of `programs/agentns/src/utils.rs`.
 *
 * These exist purely to give fast feedback in the form. The program remains the
 * authority: every rule here is re-checked on-chain, and `handle_register_name`
 * recomputes the name and re-hashes it before accepting anything.
 */

import {
  MAX_ENDPOINT_LEN,
  MAX_PART_LEN,
  MAX_URI_LEN,
  MAX_VERSION_LEN,
} from "./constants";

export type ValidationResult = { ok: true } | { ok: false; message: string };

const OK: ValidationResult = { ok: true };

function fail(message: string): ValidationResult {
  return { ok: false, message };
}

/** 1..=32 chars of [a-z0-9-], with no leading or trailing '-'. */
export function validatePart(label: string, value: string): ValidationResult {
  if (value.length === 0) return fail(`${label} is required.`);
  if (value.length > MAX_PART_LEN) {
    return fail(`${label} must be ${MAX_PART_LEN} characters or fewer.`);
  }
  if (!/^[a-z0-9-]+$/.test(value)) {
    return fail(`${label} may only use lowercase letters, digits and hyphens.`);
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    return fail(`${label} cannot start or end with a hyphen.`);
  }
  return OK;
}

/** 2 or 3 numeric parts, e.g. "1.0" or "1.2.3". */
export function validateVersion(value: string): ValidationResult {
  if (value.length === 0) return fail("Version is required.");
  if (value.length > MAX_VERSION_LEN) {
    return fail(`Version must be ${MAX_VERSION_LEN} characters or fewer.`);
  }
  const parts = value.split(".");
  if (parts.length < 2 || parts.length > 3) {
    return fail("Version must look like 1.0 or 1.2.3.");
  }
  if (!parts.every((part) => /^\d+$/.test(part))) {
    return fail("Version parts must be numbers only.");
  }
  return OK;
}

/** Must start with https:// and be at most 200 chars. */
export function validateEndpoint(value: string): ValidationResult {
  if (value.length === 0) return fail("Endpoint is required.");
  if (value.length > MAX_ENDPOINT_LEN) {
    return fail(`Endpoint must be ${MAX_ENDPOINT_LEN} characters or fewer.`);
  }
  if (!value.startsWith("https://")) {
    return fail("Endpoint must start with https://");
  }
  if (value.length === "https://".length) {
    return fail("Endpoint needs a path after https://");
  }
  return OK;
}

/** Optional, but capped at 200 chars. */
export function validateMetadataUri(value: string): ValidationResult {
  if (value.length > MAX_URI_LEN) {
    return fail(`Metadata URI must be ${MAX_URI_LEN} characters or fewer.`);
  }
  return OK;
}

/** Loose base58 check so a typo is caught before the wallet prompt opens. */
export function looksLikeAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
