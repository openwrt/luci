#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

ucode_tool=${UCODE:-ucode}
if ! command -v "$ucode_tool" >/dev/null 2>&1; then
	echo 'ucode is required to run the luci-app-bird tests' >&2
	exit 1
fi

source_file=root/usr/share/rpcd/ucode/luci.ospf
for scenario in basic full virtual af; do
	"$ucode_tool" tests/render.uc "$source_file" "$scenario" >/dev/null
	echo "render $scenario: PASS"
done

"$ucode_tool" tests/rollback.uc "$source_file"
echo 'luci-app-bird tests: PASS'
