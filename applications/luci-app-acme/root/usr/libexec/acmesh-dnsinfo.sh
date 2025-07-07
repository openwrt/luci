#!/bin/ash
[ ! -d /usr/lib/acme/client/dnsapi/ ] && exit
for f in /usr/lib/acme/client/dnsapi/dns_*.sh
do
  filename=$(basename -- "$f")
  dns_api="${filename%.*}"
  echo "$dns_api"
  dns_api_info_var="${dns_api}_info"
  # shellcheck source=./dnsapi/dns_*.sh
  . "$f"
  eval echo \"\$"$dns_api_info_var"\"
  echo
done
