use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;

use crate::constants::*;
use crate::errors::AgentNsError;
use crate::state::Protocol;

/// agent_id / capability / provider: 1..=32 chars of [a-z0-9-], no leading/trailing '-'.
pub fn validate_part(s: &str) -> Result<()> {
    let b = s.as_bytes();
    require!(
        !b.is_empty() && b.len() <= MAX_PART_LEN,
        AgentNsError::InvalidNamePart
    );
    require!(
        b.iter()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-'),
        AgentNsError::InvalidNamePart
    );
    require!(
        b[0] != b'-' && b[b.len() - 1] != b'-',
        AgentNsError::InvalidNamePart
    );
    Ok(())
}

/// Version like "1.0" or "1.2.3": 2 or 3 numeric parts.
pub fn validate_version(v: &str) -> Result<()> {
    require!(
        !v.is_empty() && v.len() <= MAX_VERSION_LEN,
        AgentNsError::InvalidVersion
    );
    let mut count = 0usize;
    for part in v.split('.') {
        require!(
            !part.is_empty() && part.bytes().all(|c| c.is_ascii_digit()),
            AgentNsError::InvalidVersion
        );
        count += 1;
    }
    require!(count == 2 || count == 3, AgentNsError::InvalidVersion);
    Ok(())
}

pub fn validate_endpoint(e: &str) -> Result<()> {
    require!(
        e.len() <= MAX_ENDPOINT_LEN && e.starts_with("https://") && e.len() > "https://".len(),
        AgentNsError::InvalidEndpoint
    );
    Ok(())
}

pub fn validate_metadata_uri(u: &str) -> Result<()> {
    require!(u.len() <= MAX_URI_LEN, AgentNsError::InvalidMetadataUri);
    Ok(())
}

/// protocol://agentID.capability.provider.vVersion
pub fn build_name(
    protocol: Protocol,
    agent_id: &str,
    capability: &str,
    provider: &str,
    version: &str,
) -> String {
    format!(
        "{}://{}.{}.{}.v{}",
        protocol.as_str(),
        agent_id,
        capability,
        provider,
        version
    )
}

/// SHA-256 of the full name. Used as the PDA seed (seeds are limited to 32 bytes).
pub fn hash_name(name: &str) -> [u8; 32] {
    hash(name.as_bytes()).to_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_the_expected_name() {
        let n = build_name(Protocol::Mcp, "sentiment", "text-analysis", "acme", "1.0");
        assert_eq!(n, "mcp://sentiment.text-analysis.acme.v1.0");
    }

    #[test]
    fn hash_matches_known_sha256() {
        // Cross-checked against Python's hashlib / Node's crypto (same preimage the TS tests use).
        let h = hash_name("mcp://sentiment.text-analysis.acme.v1.0");
        let hex: String = h.iter().map(|b| format!("{:02x}", b)).collect();
        assert_eq!(
            hex,
            "7dfe7e1c244f840b6979139900f6ae2b64f4ef980a4f42e746c7a15ced590d60"
        );
    }

    #[test]
    fn name_part_rules() {
        assert!(validate_part("sentiment").is_ok());
        assert!(validate_part("text-analysis").is_ok());
        assert!(validate_part("").is_err());
        assert!(validate_part("Upper").is_err());
        assert!(validate_part("-lead").is_err());
        assert!(validate_part("trail-").is_err());
        assert!(validate_part("has.dot").is_err());
        assert!(validate_part(&"a".repeat(33)).is_err());
        assert!(validate_part(&"a".repeat(32)).is_ok());
    }

    #[test]
    fn version_rules() {
        assert!(validate_version("1.0").is_ok());
        assert!(validate_version("1.2.3").is_ok());
        assert!(validate_version("1").is_err());
        assert!(validate_version("1.2.3.4").is_err());
        assert!(validate_version("1..2").is_err());
        assert!(validate_version("1.a").is_err());
    }

    #[test]
    fn endpoint_rules() {
        assert!(validate_endpoint("https://a.dev/x").is_ok());
        assert!(validate_endpoint("http://a.dev").is_err());
        assert!(validate_endpoint("https://").is_err());
        let long = format!("https://{}", "a".repeat(200));
        assert!(validate_endpoint(&long).is_err());
    }

    #[test]
    fn longest_possible_name_fits_the_account_field() {
        let part = "a".repeat(MAX_PART_LEN);
        let ver = "1".repeat(7) + "." + &"2".repeat(8); // 16 chars
        let n = build_name(Protocol::Mcp, &part, &part, &part, &ver);
        assert!(n.len() <= MAX_NAME_LEN, "name len {}", n.len());
    }
}
