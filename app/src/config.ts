/**
 * Runtime configuration.
 *
 * Every value here is public by definition — Vite inlines anything prefixed with
 * `VITE_` into the shipped bundle, so a private key or secret must never be added
 * to this file or to a `.env` that feeds it.
 */

export type ClusterId = "localnet" | "devnet" | "mainnet-beta";

type ClusterConfig = {
  /**
   * Wallet Standard chain identifier passed to `walletSigner({ chain })`.
   * Left as a literal type so it stays assignable without importing the
   * transitive `@solana/wallet-standard-chains` package directly.
   */
  readonly chain: "solana:localnet" | "solana:devnet" | "solana:mainnet";
  readonly label: string;
  readonly shortLabel: string;
  readonly defaultRpcUrl: string;
  readonly defaultWsUrl: string;
  readonly explorerUrl: string;
  /** Test clusters, where a mistake costs nothing. Drives the write guard. */
  readonly isTestnet: boolean;
};

const CLUSTERS: Record<ClusterId, ClusterConfig> = {
  localnet: {
    chain: "solana:localnet",
    label: "Localnet",
    shortLabel: "Local",
    defaultRpcUrl: "http://127.0.0.1:8899",
    defaultWsUrl: "ws://127.0.0.1:8900",
    explorerUrl: "https://explorer.solana.com",
    isTestnet: true,
  },
  devnet: {
    chain: "solana:devnet",
    label: "Devnet",
    shortLabel: "Devnet",
    defaultRpcUrl: "https://api.devnet.solana.com",
    defaultWsUrl: "wss://api.devnet.solana.com",
    explorerUrl: "https://explorer.solana.com",
    isTestnet: true,
  },
  "mainnet-beta": {
    chain: "solana:mainnet",
    label: "Mainnet Beta",
    shortLabel: "Mainnet",
    defaultRpcUrl: "https://api.mainnet-beta.solana.com",
    defaultWsUrl: "wss://api.mainnet-beta.solana.com",
    explorerUrl: "https://explorer.solana.com",
    isTestnet: false,
  },
};

function readClusterId(): ClusterId {
  const raw = import.meta.env.VITE_SOLANA_CLUSTER;
  if (raw === "devnet" || raw === "mainnet-beta" || raw === "localnet")
    return raw;
  return "localnet";
}

const clusterId = readClusterId();
const cluster = CLUSTERS[clusterId];

/** The selected cluster, with RPC/WS/explorer endpoints resolved. */
export const activeCluster = {
  id: clusterId,
  ...cluster,
  rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL?.trim() || cluster.defaultRpcUrl,
  wsUrl: import.meta.env.VITE_SOLANA_WS_URL?.trim() || cluster.defaultWsUrl,
} as const;

/** AgentNS program id. Must match `declare_id!` in the program. */
export const agentnsProgramId =
  import.meta.env.VITE_AGENTNS_PROGRAM_ID?.trim() ||
  "3CZ5JZgJdxX2wt8UbmyP9kkHPmiMnHhnbsUAXWj7XdnD";

/** Explorer deep-link for a transaction signature. */
export function explorerTxUrl(signature: string): string {
  return `${activeCluster.explorerUrl}/tx/${signature}`;
}

/** Explorer deep-link for an account address. */
export function explorerAddressUrl(addr: string): string {
  return `${activeCluster.explorerUrl}/address/${addr}`;
}
