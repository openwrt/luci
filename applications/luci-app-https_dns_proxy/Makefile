# Copyright 2017-2018 Stan Grishin (stangri@melmac.net)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0+
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.net>

LUCI_TITLE:=HTTPS DNS Proxy Web UI
LUCI_DESCRIPTION:=Provides Web UI for HTTPS DNS Proxy
LUCI_DEPENDS:=+luci-mod-admin-full +https_dns_proxy
LUCI_PKGARCH:=all
PKG_RELEASE:=7

define Package/luci-app-https_dns_proxy/postinst
#!/bin/sh
# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	uci -q batch <<-EOF >/dev/null
	delete ucitrack.@https_dns_proxy[-1]
	add ucitrack https_dns_proxy
	set ucitrack.@https_dns_proxy[-1].init=https_dns_proxy
	commit ucitrack
EOF
	if ! uci -q get dhcp.@dnsmasq[0].doh_backup_server >/dev/null; then
		for i in $$(uci -q get dhcp.@dnsmasq[0].server); do
			uci -q add_list dhcp.@dnsmasq[0].doh_backup_server="$${i}"
		done
		uci -q commit dhcp
	fi
	rm -f /tmp/luci-indexcache
fi
exit 0
endef

define Package/luci-app-https_dns_proxy/prerm
#!/bin/sh
# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	if uci -q get dhcp.@dnsmasq[0].doh_backup_server >/dev/null; then
		uci -q del dhcp.@dnsmasq[0].server || true
		for i in $$(uci -q get dhcp.@dnsmasq[0].doh_backup_server); do
			uci -q add_list dhcp.@dnsmasq[0].server="$${i}" || true
		done
		uci -q delete dhcp.@dnsmasq[0].doh_backup_server
		uci -q commit dhcp
		/etc/init.d/dnsmasq restart >/dev/null 2>&1 || true
	fi
fi
exit 0
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
