/// <reference types="vite/client" />

/**
 * Typed view of the `VITE_` variables this app reads. Every one of them is a
 * public value (an RPC URL or the program id) — never a secret.
 */
interface ImportMetaEnv {
  readonly VITE_SOLANA_CLUSTER?: "localnet" | "devnet" | "mainnet-beta";
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_SOLANA_WS_URL?: string;
  readonly VITE_AGENTNS_PROGRAM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
