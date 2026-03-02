#!/bin/sh
# Minimal jshn stub for list command
__json_items=""
__json_cur=""
__json_depth=0
json_init() { __json_items=""; __json_cur=""; __json_depth=0; }
json_add_object() {
	if [ $__json_depth -eq 0 ]; then
		__json_cur="\"$1\":{"
	else
		__json_cur="${__json_cur}\"$1\":{"
	fi
	__json_depth=$((__json_depth+1))
}
json_add_string() { __json_cur="${__json_cur}\"$1\":\"$2\","; }
json_close_object() {
	__json_cur="${__json_cur%,}}"
	__json_depth=$((__json_depth-1))
	if [ $__json_depth -eq 0 ]; then
		__json_items="${__json_items:+${__json_items},}${__json_cur}"
		__json_cur=""
	else
		__json_cur="${__json_cur},"
	fi
}
json_dump() { echo "{${__json_items}}"; }
json_cleanup() { __json_items=""; __json_cur=""; }
