// ===== Phase 1: registry =====
pub mod initialize_config;
pub mod register_name;
pub mod revoke_name;
pub mod transfer_name;
pub mod update_config;
pub mod update_endpoint;

pub use initialize_config::*;
pub use register_name::*;
pub use revoke_name::*;
pub use transfer_name::*;
pub use update_config::*;
pub use update_endpoint::*;


// ===== Phase 2: trust / stake (added in branch phase2-trust) =====
// New `pub mod` and `pub use` lines for Phase 2 go directly below this line.


// ===== Phase 3: marketplace (added in branch phase3-marketplace) =====
// New `pub mod` and `pub use` lines for Phase 3 go directly below this line.
