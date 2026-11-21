#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
MODDIR="$PACKAGE_DIR/root/usr/share/ucode"
UCODE="${UCODE:-ucode}"

"$UCODE" -L "$MODDIR" "$SCRIPT_DIR/storage-core.uc"
