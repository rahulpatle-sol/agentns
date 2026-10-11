#!/usr/bin/env bash
# Watches the AgentNS program for Phase 2 / Phase 3 instructions becoming real.
#
# Phase 2 and 3 are "built" only when all three of these are true:
#   1. instructions/mod.rs declares the module
#   2. lib.rs registers the #[program] wrapper
#   3. target/idl/agentns.json lists the instruction
#
# Until then the frontend cannot call them: there is no IDL entry to encode from.
# Run:  ./watch-phase.sh          (Ctrl-C to stop)

set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
LIB="$ROOT/programs/agentns/src/lib.rs"
MOD="$ROOT/programs/agentns/src/instructions/mod.rs"
IDL="$ROOT/target/idl/agentns.json"

P2="top_up_stake request_unstake mark_endpoint_verified"
P3="list_name buy_name cancel_listing"

snake_to_camel() { echo "$1" | awk -F_ '{for(i=1;i<=NF;i++) printf toupper(substr($i,1,1)) substr($i,2); }'; }

status() {
  local wired=0 total=0
  for f in $P2 $P3; do
    total=$((total+1))
    local camel; camel="$(snake_to_camel "$f")"
    if grep -q "pub mod $f;" "$MOD" 2>/dev/null \
       && grep -q "pub fn $camel" "$LIB" 2>/dev/null \
       && grep -q "\"$camel\"" "$IDL" 2>/dev/null; then
      wired=$((wired+1))
      printf "  [wired] %s\n" "$camel"
    else
      printf "  [pending] %s\n" "$camel"
    fi
  done
  echo "  wired: $wired / $total"
  echo "$wired" > /tmp/agentns-phase-wired.txt
}

echo "AgentNS phase watcher — polling every 10s. Ctrl-C to stop."
last=""
while true; do
  out="$(status)"
  if [ "$out" != "$last" ]; then
    echo "--- $(date +%H:%M:%S) ---"
    echo "$out"
    last="$out"
    if [ "$(cat /tmp/agentns-phase-wired.txt)" = "6" ]; then
      echo ""
      echo "ALL PHASE 2 + 3 INSTRUCTIONS ARE WIRED. The frontend can be built against them."
      exit 0
    fi
  fi
  sleep 10
done