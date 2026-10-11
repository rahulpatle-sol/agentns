import { useEffect, useRef, useState } from "react";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWalletStatus,
  useWallets,
  WalletReadyGate,
} from "@solana/kit-plugin-wallet/react";
import type { Address } from "@solana/kit";
import { useClient } from "@solana/react";

import { activeCluster } from "../../config";
import { shortenAddress } from "../../lib/format";
import type { AppClient } from "../../state/client";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Feedback";

/**
 * Wallet connection control.
 *
 * Discovery stays hidden behind `WalletReadyGate` so the button never flashes
 * "No wallets" while Wallet Standard is still enumerating. The connected state
 * shows the truncated address, the wallet name, a SOL balance and a working
 * disconnect menu.
 */
export function WalletButton() {
  const client = useClient<AppClient>();
  return (
    <WalletReadyGate
      client={client}
      fallback={<span className="wallet-placeholder" aria-hidden="true" />}
    >
      <ConnectedWalletControl />
    </WalletReadyGate>
  );
}

function ConnectedWalletControl() {
  const client = useClient<AppClient>();
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const status = useWalletStatus(client);
  const { dispatch: connect } = useConnect(client);
  const { dispatch: disconnect } = useDisconnect(client);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (!connected) {
    if (wallets.length === 0) {
      return (
        <span className="wallet-empty">
          No wallet found. Install a Wallet Standard wallet such as Phantom.
        </span>
      );
    }

    if (wallets.length === 1) {
      return (
        <Button
          variant="primary"
          size="sm"
          onClick={() => connect(wallets[0])}
          loading={status === "connecting"}
        >
          Connect wallet
        </Button>
      );
    }

    return (
      <div className="wallet-menu" ref={menuRef}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          Connect wallet
        </Button>
        {menuOpen ? (
          <div className="wallet-menu__list" role="menu">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                type="button"
                role="menuitem"
                className="wallet-menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  connect(wallet);
                }}
              >
                <span className="wallet-menu__icon" aria-hidden="true">
                  {(wallet.icon ?? "").startsWith("data:") ? (
                    <img src={wallet.icon} alt="" width={20} height={20} />
                  ) : (
                    "◎"
                  )}
                </span>
                {wallet.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const address = connected.account.address as Address;

  return (
    <div className="wallet-menu" ref={menuRef}>
      <button
        type="button"
        className="wallet-chip"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`Connected to ${connected.wallet.name}, address ${address}. Open account menu.`}
      >
        <span className="wallet-chip__dot" aria-hidden="true" />
        <span className="wallet-chip__address mono">
          {shortenAddress(address, 4, 4)}
        </span>
      </button>

      {menuOpen ? (
        <div className="wallet-menu__list wallet-menu__list--wide" role="menu">
          <div className="wallet-menu__meta">
            <span className="wallet-menu__label">Connected wallet</span>
            <span className="wallet-menu__value">{connected.wallet.name}</span>
            <span className="wallet-menu__label">Address</span>
            <span className="wallet-menu__value mono">{address}</span>
            <BalanceRow client={client} address={address} />
          </div>
          <button
            type="button"
            role="menuitem"
            className="wallet-menu__item wallet-menu__item--danger"
            onClick={() => {
              setMenuOpen(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BalanceRow({
  client,
  address,
}: {
  client: AppClient;
  address: Address;
}) {
  const [lamports, setLamports] = useState<bigint | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLamports(null);
    setError(false);
    client.rpc
      .getBalance(address)
      .send()
      .then((response) => {
        if (!cancelled) setLamports(response.value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [client, address]);

  return (
    <>
      <span className="wallet-menu__label">Balance</span>
      <span className="wallet-menu__value num">
        {error
          ? "Unavailable"
          : lamports === null
            ? "…"
            : `${(Number(lamports) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`}
      </span>
    </>
  );
}

/** Shows the active cluster. Read-only: the endpoint is a build-time setting. */
export function NetworkBadge() {
  const tone = activeCluster.isTestnet ? "lime" : "warning";
  return (
    <Badge tone={tone} pulse>
      {activeCluster.label}
    </Badge>
  );
}
