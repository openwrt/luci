#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
MODDIR="$PACKAGE_DIR/root/usr/share/ucode"
UCODE="${UCODE:-ucode}"

TMPDIR_TEST="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_TEST"' EXIT HUP INT TERM

mkdir -p "$TMPDIR_TEST/etc" \
         "$TMPDIR_TEST/ram" \
         "$TMPDIR_TEST/run" \
         "$TMPDIR_TEST/usb" \
         "$TMPDIR_TEST/usb2"

"$UCODE" -L "$MODDIR" "$SCRIPT_DIR/recovery.uc" "$TMPDIR_TEST"
