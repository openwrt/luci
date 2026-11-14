#!/bin/sh

set -eu

TEST_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_DIR=$(dirname "$TEST_DIR")

exec ucode -L "$APP_DIR/root/usr/share/ucode" "$TEST_DIR/parser.uc"
