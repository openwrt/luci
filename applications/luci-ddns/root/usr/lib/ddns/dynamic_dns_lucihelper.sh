#!/bin/sh
# /usr/lib/ddns/luci_dns_helper.sh
#
# Written in August 2014
# by Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
# This script is used by luci-app-ddns
# - getting registered IP
# - check if possible to get local IP
# - verifing given DNS- or Proxy-Server
#
# variables in small chars are read from /etc/config/ddns as parameter given here
# variables in big chars are defined inside these scripts as gloval vars
# variables in big chars beginning with "__" are local defined inside functions only
# set -vx  	#script debugger

[ $# -lt 2 ] && exit 1

. /usr/lib/ddns/dynamic_dns_functions.sh	# global vars are also defined here

# set -vx  	#script debugger

# preset some variables, wrong or not set in dynamic_dns_functions.sh
SECTION_ID="lucihelper"
LOGFILE="$LOGDIR/$SECTION_ID.log"
VERBOSE_MODE=0		# no console logging
# global variables normally set by reading DDNS UCI configuration
use_syslog=0		# no syslog
use_logfile=0		# by default no logfile, can be changed here

case "$1" in
	get_registered_ip)
		local IP
		domain=$2			# Hostname/Domain
		use_ipv6=${3:-"0"}		# Use IPv6 - default IPv4
		force_ipversion=${4:-"0"}	# Force IP Version - default 0 - No
		force_dnstcp=${5:-"0"}		# Force TCP on DNS - default 0 - No
		dns_server=${6:-""}		# DNS server - default No DNS
		write_log 7 "-----> get_registered_ip IP"
		get_registered_ip IP
		[ $? -ne 0 ] && IP=""
		echo -n "$IP"			# suppress LF
		;;
	verify_dns)
		# $2 : dns-server to verify	# no need for force_dnstcp because
						# verify with nc (netcat) uses tcp anyway
		use_ipv6=${3:-"0"}		# Use IPv6 - default IPv4
		force_ipversion=${4:-"0"}	# Force IP Version - default 0 - No
		write_log 7 "-----> verify_dns '$2'"
		verify_dns "$2"
		;;
	verify_proxy)
		# $2 : proxy string to verify
		use_ipv6=${3:-"0"}		# Use IPv6 - default IPv4
		force_ipversion=${4:-"0"}	# Force IP Version - default 0 - No
		write_log 7 "-----> verify_proxy '$2'"
		verify_proxy "$2"
		;;
	get_local_ip)
		local IP
		use_ipv6="$2"			# Use IPv6
		ip_source="$3"			# IP source
		ip_network="$4"			# set if source = "network" otherwise "-"
		ip_url="$5"			# set if source = "web" otherwise "-"
		ip_interface="$6"		# set if source = "interface" itherwiase "-"
		ip_script="$7"			# set if source = "script" otherwise "-"
		proxy="$8"			# proxy if set
		force_ipversion="0"		# not needed but must be set
		use_https="0"			# not needed but must be set
		[ -n "$proxy" -a "$ip_source" = "web" ] && {
			# proxy defined, used for ip_source=web
			export HTTP_PROXY="http://$proxy"
			export HTTPS_PROXY="http://$proxy"
			export http_proxy="http://$proxy"
			export https_proxy="http://$proxy"
		}
		# don't need IP only the return code
		[ "$ip_source" = "web" -o  "$ip_source" = "script" ] && {
			# we wait only 3 seconds for an
			# answer from "web" or "script"
			write_log 7 "-----> timeout 3 -- get_local_ip IP"
			timeout 3 -- get_local_ip IP
		} || {
			write_log 7 "-----> get_local_ip IP"
			get_local_ip IP
		}
		;;
	*)
		return 255
		;;
esac
