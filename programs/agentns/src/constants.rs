//! Seeds and size limits used across the program.

pub const CONFIG_SEED: &[u8] = b"config";
pub const AGENT_SEED: &[u8] = b"agent";

/// agent_id, capability and provider: 1..=32 chars of [a-z0-9-].
pub const MAX_PART_LEN: usize = 32;
/// Version string like "1.0" or "1.2.3".
pub const MAX_VERSION_LEN: usize = 16;
/// "mcp://" + 3 parts + dots + ".v" + version, always <= 128.
pub const MAX_NAME_LEN: usize = 128;
pub const MAX_ENDPOINT_LEN: usize = 200;
pub const MAX_URI_LEN: usize = 200;
