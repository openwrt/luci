include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Ash Clarke <clarkeaj@hotmail.co.uk>

LUCI_TITLE:=LuCI interface for qosify
LUCI_DESCRIPTION:=Web UI for the qosify CAKE/eBPF traffic shaping daemon
LUCI_DEPENDS:=+luci-base +qosify
PKG_PROVIDES:=luci-app-qos

# qosify leaves clsact and ifb-dns behind when it stops, and its own prerm may
# run after this one, so a copy of cleanup waits in the background for qosify to
# exit. If qosify stays installed and running it touches nothing.
define Package/luci-app-qosify/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || [ "$${PKG_UPGRADE}" = 1 ] || {
	cp /usr/share/qosify-luci/cleanup /tmp/qosify-luci-cleanup &&
	( /tmp/qosify-luci-cleanup wait; rm -f /tmp/qosify-luci-cleanup ) \
		</dev/null >/dev/null 2>&1 &
}
exit 0
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
