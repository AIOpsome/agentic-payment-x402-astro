#!/usr/bin/env bash
# Packs both packages, installs the real tarballs into a throwaway Astro app outside the
# workspace, and builds it. An in-workspace build resolves through pnpm symlinks and therefore
# cannot catch a missing `exports` subpath in the published artifact.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/x402-packed-verify.XXXXXX")"
TARBALL_DIR="$WORK_DIR/tarballs"
APP_DIR="$WORK_DIR/app"

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$TARBALL_DIR"

echo "==> Packing packages"
(cd "$REPO_ROOT/packages/agentic-payment-x402-core" && pnpm pack --pack-destination "$TARBALL_DIR" >/dev/null)
(cd "$REPO_ROOT/packages/agentic-payment-x402-astro" && pnpm pack --pack-destination "$TARBALL_DIR" >/dev/null)

CORE_TGZ="$(ls "$TARBALL_DIR"/agentic-payment-x402-core-*.tgz)"
ASTRO_TGZ="$(ls "$TARBALL_DIR"/agentic-payment-x402-astro-*.tgz)"

echo "==> Scaffolding throwaway Astro app at $APP_DIR"
mkdir -p "$APP_DIR/src/pages/checkout" "$APP_DIR/src/pages/api/x402" "$APP_DIR/src/lib"

cat > "$APP_DIR/package.json" <<'JSON'
{
  "name": "x402-packed-artifact-check",
  "private": true,
  "type": "module",
  "version": "0.0.0"
}
JSON

cat > "$APP_DIR/astro.config.mjs" <<'JS'
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import agenticPay from 'agentic-payment-x402-astro';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    agenticPay({
      payTo: '0x1111111111111111111111111111111111111111',
      network: 'eip155:84532',
      facilitators: ['https://facilitator.payai.network'],
      protectedRoutes: { '/api/premium-report': 5.0 },
    }),
  ],
});
JS

cat > "$APP_DIR/src/lib/orders.ts" <<'TS'
export async function getOrder(orderId: string) {
  return { id: orderId, totalUsd: 2500, status: 'awaiting_payment' as const };
}
TS

# Import form here must match the README's documented import form exactly.
cat > "$APP_DIR/src/pages/checkout/[orderId].astro" <<'ASTRO'
---
import AgenticPayButton from 'agentic-payment-x402-astro/components/AgenticPayButton.astro';
import WalletCheckout from 'agentic-payment-x402-astro/components/WalletCheckout.astro';
import { getOrder } from '../../lib/orders';

const order = await getOrder(Astro.params.orderId!);
---
<html><body>
<AgenticPayButton
  orderId={order.id}
  amount={order.totalUsd}
  currency="USD"
  payTo="0x1111111111111111111111111111111111111111"
  network="eip155:84532"
  buttonText={`Pay $${order.totalUsd} USDC`}
  onSuccessRedirect="/onboarding/success"
/>
<WalletCheckout
  title="SignalOps Retainer"
  orderId={order.id}
  amount={order.totalUsd}
  currency="USD"
  payTo="0x1111111111111111111111111111111111111111"
  network="eip155:84532"
  onSuccessRedirect="/onboarding/success"
/>
</body></html>
ASTRO

cat > "$APP_DIR/src/pages/api/x402/settle.ts" <<'TS'
import { createX402SettlementHandler } from 'agentic-payment-x402-astro/endpoints';
import { getOrder } from '../../../lib/orders';

export const POST = createX402SettlementHandler({
  payTo: '0x1111111111111111111111111111111111111111',
  network: 'eip155:84532',
  facilitators: ['https://facilitator.payai.network'],
  resolveOrderAmount: async ({ orderId }) => {
    if (typeof orderId !== 'string' || orderId === '') return null;
    const order = await getOrder(orderId);
    return order?.totalUsd ?? null;
  },
});
TS

echo "==> Installing packed tarballs from the npm registry's perspective"
(cd "$APP_DIR" && npm install --no-audit --no-fund \
  'astro@^5.4.2' '@astrojs/node@^9' "$ASTRO_TGZ" "$CORE_TGZ" >/dev/null)

echo "==> Building the throwaway app against the installed tarballs"
(cd "$APP_DIR" && npx astro build)

echo "==> Verifying the components actually rendered"
HOST=127.0.0.1 PORT=4331 node "$APP_DIR/dist/server/entry.mjs" > "$WORK_DIR/server.log" 2>&1 &
SERVER_PID=$!

PAGE=""
for _ in $(seq 1 30); do
  if PAGE="$(curl -sf http://127.0.0.1:4331/checkout/ORDER_RETAINER)"; then break; fi
  sleep 1
done

if [ -z "$PAGE" ]; then
  echo "FAIL: built app never served /checkout/ORDER_RETAINER"
  cat "$WORK_DIR/server.log"
  exit 1
fi

fail=0
for needle in 'data-orderid="ORDER_RETAINER"' 'Pay $2500 USDC' 'SignalOps Retainer' 'Base Sepolia (Testnet)'; do
  if ! printf '%s' "$PAGE" | grep -qF "$needle"; then
    echo "FAIL: rendered page is missing: $needle"
    fail=1
  fi
done

if ! ls "$APP_DIR"/dist/client/_astro/AgenticPayButton*.js >/dev/null 2>&1; then
  echo "FAIL: client island bundle for AgenticPayButton was not emitted"
  fail=1
elif ! grep -q 'orderId' "$APP_DIR"/dist/client/_astro/AgenticPayButton*.js; then
  echo "FAIL: client bundle does not send orderId in the settlement body"
  fail=1
fi

if [ "$fail" -ne 0 ]; then exit 1; fi

echo "==> OK: packed tarballs expose the documented component imports and both components render"
