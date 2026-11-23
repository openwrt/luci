#!/bin/sh
# SPDX-License-Identifier: Apache-2.0

. /lib/netifd/netifd-proto.sh
init_proto "$@"

proto_ssh_tunnel_init_config() {
	available=1
	no_device=1
	no_device_config=1
	proto_config_add_string server
	proto_config_add_int port
	proto_config_add_string username
	proto_config_add_string password
	proto_config_add_string identity_file
	proto_config_add_string host_key_file
	proto_config_add_string invitation
	proto_config_add_string connection_mode
	proto_config_add_boolean invited
	proto_config_add_boolean disabled
}

proto_ssh_tunnel_setup() {
	local interface="$1" section server port username password identity_file host_key_file invitation connection_mode invited device disabled auth
	json_get_vars server port username password identity_file host_key_file invitation connection_mode invited disabled
	section="network.$interface"
	# A running netifd may still filter the JSON using the previous package's schema.
	# During retries, that JSON may also still contain a redeemed invitation.
	if [ "$(uci -q get "$section.proto")" = "ssh_tunnel" ]; then
		connection_mode="$(uci -q get "$section.connection_mode")"
		invitation="$(uci -q get "$section.invitation")"
		invited="$(uci -q get "$section.invited")"
	fi
	port="${port:-22}"
	if [ "$connection_mode" = "manual" ]; then
		invited=0
	elif [ -n "$invitation" ]; then
		if ! printf '%s\n' "$invitation" | /usr/libexec/ssh-tunnel-invite import "$interface" "$port"; then
			proto_notify_error "$interface" INVITATION_FAILED
			return
		fi
		invited="$(uci -q get "$section.invited")"
	elif [ "$connection_mode" = "invite" ] && [ "$invited" != "1" ]; then
		proto_notify_error "$interface" NO_INVITATION
		return
	fi
	if [ "$invited" = "1" ] && [ "$(uci -q get "$section.proto")" = "ssh_tunnel" ]; then
		server="$(uci -q get "$section.server")"
		port="$(uci -q get "$section.port")"
		username="$(uci -q get "$section.username")"
		identity_file="$(uci -q get "$section.identity_file")"
		host_key_file="$(uci -q get "$section.host_key_file")"
	fi
	[ -n "$server" ] && [ -n "$username" ] || { proto_notify_error "$interface" NO_SERVER; return; }
	port="${port:-22}"
	if [ "$invited" = "1" ]; then
		[ -n "$identity_file" ] && [ -r "$identity_file" ] && [ -n "$host_key_file" ] && [ -r "$host_key_file" ] || { proto_notify_error "$interface" NO_CREDENTIALS; return; }
		auth=invite
	else
		[ -n "$identity_file" ] || [ -n "$password" ] || { proto_notify_error "$interface" NO_CREDENTIALS; return; }
		auth="${identity_file:+key}"
		[ -n "$identity_file" ] || auth=password
	fi
	device="st$(printf '%s' "$interface" | md5sum | cut -c1-13)"
	if ! /usr/libexec/ssh-tunnel-client --create "$device"; then
		/usr/libexec/ssh-tunnel-client --delete "$device" >/dev/null 2>&1
		proto_notify_error "$interface" TUN_CREATE_FAILED
		return
	fi
	proto_init_update "$device" 1
	proto_add_ipv4_address 172.31.255.2 30 "" 172.31.255.1
	proto_send_update "$interface"
	if [ "$auth" = "invite" ]; then
		proto_run_command "$interface" /usr/libexec/ssh-tunnel-client "$server" "$port" "$username" "$device" "$identity_file" invite "$host_key_file"
	elif [ "$auth" = "key" ]; then
		proto_run_command "$interface" /usr/libexec/ssh-tunnel-client "$server" "$port" "$username" "$device" "$identity_file" key
	else
		proto_run_command "$interface" /usr/bin/env "SSHPASS=$password" /usr/libexec/ssh-tunnel-client "$server" "$port" "$username" "$device" - password
	fi
}

proto_ssh_tunnel_teardown() {
	local interface="$1" device
	device="st$(printf '%s' "$interface" | md5sum | cut -c1-13)"
	proto_kill_command "$interface"
	/usr/libexec/ssh-tunnel-client --delete "$device" >/dev/null 2>&1
}

add_protocol ssh_tunnel
