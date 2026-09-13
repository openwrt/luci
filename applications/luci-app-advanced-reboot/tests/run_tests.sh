#!/usr/bin/env bash
# Functional test runner for luci-app-advanced-reboot.
#
# Tests:
#   00: Device JSON validation (structure, required fields)
#   01: Error handling (missing board, unknown device, bad args)
#   02: obtain_device_info (fw_printenv, dual-flag)
#   03: boot_partition (switch, failure)
#
# Usage: cd source.mossdef.org/luci-app-advanced-reboot && bash tests/run_tests.sh

set -o pipefail

line='........................................'

# ── Patch phase ─────────────────────────────────────────────────────
# Convert ES namespace import to require() so the mock framework can
# intercept the fs module through the module cache.

patch_dir="/tmp/ar_test_modules.$$"
mkdir -p "$patch_dir"

sed \
	-e 's|import \* as fs from "fs";|let fs = require("fs");|' \
	./root/usr/share/rpcd/ucode/luci.advanced-reboot > "$patch_dir/advanced_reboot.uc"

trap "rm -rf '$patch_dir'" EXIT

# Search paths: patched module first, then tests/lib (for mocklib)
ucode="ucode -S -L$patch_dir -L./tests/lib"

# ── Device JSON validation ──────────────────────────────────────────

DEVICES_DIR="./root/usr/share/advanced-reboot/devices"

n_tests=0
n_fails=0

pass() {
	printf "  PASS: %s\n" "$1"
}
fail() {
	printf "  FAIL: %s\n" "$1"
	[ -n "$2" ] && printf "        %s\n" "$2"
	n_fails=$((n_fails + 1))
}

if [ -d "$DEVICES_DIR" ]; then
	printf "\n##\n## 00: Device JSON validation\n##\n\n"

	device_count=0
	for f in "$DEVICES_DIR"/*.json; do
		[ -f "$f" ] || continue
		device_count=$((device_count + 1))
		base="$(basename "$f")"

		# Valid JSON
		n_tests=$((n_tests + 1))
		if ! jq empty "$f" 2>/dev/null; then
			fail "$base: invalid JSON"
			continue
		fi
		pass "$base: valid JSON"

		# Required: device.vendor
		n_tests=$((n_tests + 1))
		vendor="$(jq -r '.device.vendor // empty' "$f")"
		if [ -n "$vendor" ]; then
			pass "$base: has device.vendor '$vendor'"
		else
			fail "$base: missing device.vendor"
		fi

		# Required: device.model
		n_tests=$((n_tests + 1))
		model="$(jq -r '.device.model // empty' "$f")"
		if [ -n "$model" ]; then
			pass "$base: has device.model '$model'"
		else
			fail "$base: missing device.model"
		fi

		# Required: device.board (must be array)
		n_tests=$((n_tests + 1))
		board_type="$(jq -r '.device.board | type' "$f")"
		if [ "$board_type" = "array" ]; then
			board_len="$(jq '.device.board | length' "$f")"
			if [ "$board_len" -gt 0 ]; then
				pass "$base: device.board is array with $board_len entries"
			else
				fail "$base: device.board is empty array"
			fi
		else
			fail "$base: device.board is not an array (got $board_type)"
		fi

		# Required: partitions (must be array with >= 2 entries)
		n_tests=$((n_tests + 1))
		part_type="$(jq -r '.partitions | type' "$f")"
		if [ "$part_type" = "array" ]; then
			part_len="$(jq '.partitions | length' "$f")"
			if [ "$part_len" -ge 2 ]; then
				pass "$base: has $part_len partitions"
			else
				fail "$base: need >= 2 partitions (got $part_len)"
			fi
		else
			fail "$base: partitions is not an array"
		fi

		# Each partition must have number and param_values
		for i in $(seq 0 $((part_len - 1))); do
			n_tests=$((n_tests + 1))
			has_num="$(jq ".partitions[$i] | has(\"number\")" "$f")"
			has_pv="$(jq ".partitions[$i] | has(\"param_values\")" "$f")"
			if [ "$has_num" = "true" ] && [ "$has_pv" = "true" ]; then
				pass "$base: partition $i has number and param_values"
			else
				fail "$base: partition $i missing number ($has_num) or param_values ($has_pv)"
			fi
		done
	done

	printf "\n  Validated %d device files\n" "$device_count"
fi

# ── Mock-based functional tests ────────────────────────────────────

extract_sections() {
	local file=$1
	local dir=$2
	local count=0
	local tag line outfile

	while IFS= read -r line; do
		case "$line" in
			"-- Testcase --")
				tag="test"
				count=$((count + 1))
				outfile=$(printf "%s/%03d.in" "$dir" $count)
				printf "" > "$outfile"
			;;
			"-- Environment --")
				tag="env"
				count=$((count + 1))
				outfile=$(printf "%s/%03d.env" "$dir" $count)
				printf "" > "$outfile"
			;;
			"-- Expect stdout --"|"-- Expect stderr --"|"-- Expect exitcode --")
				tag="${line#-- Expect }"
				tag="${tag% --}"
				count=$((count + 1))
				outfile=$(printf "%s/%03d.%s" "$dir" $count "$tag")
				printf "" > "$outfile"
			;;
			"-- File "*" --")
				tag="file"
				outfile="${line#-- File }"
				outfile="$(echo "${outfile% --}" | xargs)"
				outfile="$dir/files$(readlink -m "/${outfile:-file}")"
				mkdir -p "$(dirname "$outfile")"
				printf "" > "$outfile"
			;;
			"-- End --")
				tag=""
				outfile=""
			;;
			*)
				if [ -n "$tag" ]; then
					printf "%s\\n" "$line" >> "$outfile"
				fi
			;;
		esac
	done < "$file"

	return $(ls -l "$dir/"*.in 2>/dev/null | wc -l)
}

run_testcase() {
	local num=$1
	local dir=$2
	local in=$3
	local env=$4
	local out=$5
	local err=$6
	local code=$7
	local fail=0

	$ucode \
		-D MOCK_SEARCH_PATH='["'"$dir"'/files", "./tests/mocks"]' \
		${env:+-F "$env"} \
		-l mocklib \
		- <"$in" >"$dir/res.out" 2>"$dir/res.err"

	printf "%d\n" $? > "$dir/res.code"

	touch "$dir/empty"

	if ! cmp -s "$dir/res.err" "${err:-$dir/empty}"; then
		[ $fail = 0 ] && printf "!\n"
		printf "Testcase #%d: Expected stderr did not match:\n" $num
		diff -u --color=always --label="Expected stderr" --label="Resulting stderr" "${err:-$dir/empty}" "$dir/res.err"
		printf -- "---\n"
		fail=1
	fi

	if ! cmp -s "$dir/res.out" "${out:-$dir/empty}"; then
		[ $fail = 0 ] && printf "!\n"
		printf "Testcase #%d: Expected stdout did not match:\n" $num
		diff -u --color=always --label="Expected stdout" --label="Resulting stdout" "${out:-$dir/empty}" "$dir/res.out"
		printf -- "---\n"
		fail=1
	fi

	if [ -n "$code" ] && ! cmp -s "$dir/res.code" "$code"; then
		[ $fail = 0 ] && printf "!\n"
		printf "Testcase #%d: Expected exit code did not match:\n" $num
		diff -u --color=always --label="Expected code" --label="Resulting code" "$code" "$dir/res.code"
		printf -- "---\n"
		fail=1
	fi

	return $fail
}

run_test() {
	local file=$1
	local name=${file##*/}
	local res ecode eout eerr ein eenv tests
	local testcase_first=0 failed=0 count=0

	printf "%s %s " "$name" "${line:${#name}}"

	mkdir "/tmp/test.$$"

	extract_sections "$file" "/tmp/test.$$"
	tests=$?

	[ -f "/tmp/test.$$/001.in" ] && testcase_first=1

	for res in "/tmp/test.$$/"[0-9]*; do
		case "$res" in
			*.in)
				count=$((count + 1))

				if [ $testcase_first = 1 ]; then
					# Flush previous test
					if [ -n "$ein" ]; then
						run_testcase $count "/tmp/test.$$" "$ein" "$eenv" "$eout" "$eerr" "$ecode" || failed=$((failed + 1))

						eout=""
						eerr=""
						ecode=""
						eenv=""
					fi

					ein=$res
				else
					run_testcase $count "/tmp/test.$$" "$res" "$eenv" "$eout" "$eerr" "$ecode" || failed=$((failed + 1))

					eout=""
					eerr=""
					ecode=""
					eenv=""
				fi

			;;
			*.env) eenv=$res ;;
			*.stdout) eout=$res ;;
			*.stderr) eerr=$res ;;
			*.exitcode) ecode=$res ;;
		esac
	done

	# Flush last test
	if [ $testcase_first = 1 ] && [ -n "$ein" ]; then
		run_testcase $count "/tmp/test.$$" "$ein" "$eenv" "$eout" "$eerr" "$ecode" || failed=$((failed + 1))
	fi

	rm -r "/tmp/test.$$"

	if [ $failed = 0 ]; then
		printf "OK\n"
	else
		printf "%s %s FAILED (%d/%d)\n" "$name" "${line:${#name}}" $failed $tests
	fi

	return $failed
}


select_tests="$@"

use_test() {
	local input="$(readlink -f "$1")"
	local test

	[ -f "$input" ] || return 1
	[ -n "$select_tests" ] || return 0

	for test in $select_tests; do
		test="$(readlink -f "$test")"

		[ "$test" != "$input" ] || return 0
	done

	return 1
}

for catdir in tests/[0-9][0-9]_*; do
	[ -d "$catdir" ] || continue

	printf "\n##\n## Running %s tests\n##\n\n" "${catdir##*/[0-9][0-9]_}"

	for testfile in "$catdir/"[0-9][0-9]_*; do
		use_test "$testfile" || continue

		n_tests=$((n_tests + 1))
		run_test "$testfile" || n_fails=$((n_fails + 1))
	done
done

# ── Shell script syntax checks ──────────────────────────────────────

printf "\n##\n## Checking shell script syntax\n##\n\n"
for shellscript in \
	root/etc/uci-defaults/* \
	root/usr/share/advanced-reboot/helpers/*.sh; do
	[ -f "$shellscript" ] || continue
	head -1 "$shellscript" | grep -q '^#!/bin/sh' || continue
	name="${shellscript#root/}"
	n_tests=$((n_tests + 1))
	printf "%s %s " "$name" "${line:${#name}}"
	if sh -n "$shellscript" 2>/dev/null; then
		printf "OK\n"
	else
		printf "FAIL\n"
		sh -n "$shellscript"
		n_fails=$((n_fails + 1))
	fi
done

printf "\nRan %d tests, %d okay, %d failures\n" $n_tests $((n_tests - n_fails)) $n_fails
exit $n_fails
