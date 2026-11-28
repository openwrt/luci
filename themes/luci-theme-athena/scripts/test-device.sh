#!/bin/sh
set -eu
BASE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ATHENA_SSH_CMD=${ATHENA_SSH:?Set ATHENA_SSH to the OpenWrt test device SSH wrapper}
node "$BASE/tests/make-icon.mjs"
cleanup() {
  "$ATHENA_SSH_CMD" 'rm -rf /tmp/athena-rpc-test-assets /tmp/athena-rpc-test.uc /tmp/athena-test-icon.png /tmp/athena-tests.uc /tmp/athena-upload-4c69e89b9ed03a2b49eddb64c472cd4b.tmp'
}
trap cleanup EXIT
sed 's@/www/luci-static/athena/branding@/tmp/athena-rpc-test-assets@' "$BASE/root/usr/share/rpcd/ucode/luci.athena" | "$ATHENA_SSH_CMD" 'cat > /tmp/athena-rpc-test.uc'
cat "$BASE/tests/fixtures/icon.png" | "$ATHENA_SSH_CMD" 'cat > /tmp/athena-test-icon.png'
cat "$BASE/tests/rpc.uc" | "$ATHENA_SSH_CMD" 'cat > /tmp/athena-tests.uc; ucode /tmp/athena-tests.uc'
