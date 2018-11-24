#/bin/sh
conf_dir="/etc/shadowsocksr/"
script_dir="/usr/share/shadowsocksr/"
${script_dir}chnroute.sh ${conf_dir}china_chnroute.txt
${script_dir}gfwlist2dnsmasq.sh -d 127.0.0.1 -p 5300 -o ${conf_dir}dnsmasq_gfwlist.conf
/etc/init.d/shadowsocksr restart