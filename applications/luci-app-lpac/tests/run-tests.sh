#!/bin/sh
# SPDX-License-Identifier: Apache-2.0

set -eu

cd "$(dirname "$0")/.."
exec ucode -S -L ./tests/lib ./tests/backend.uc
