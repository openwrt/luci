#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=luci

LUCI_TITLE:=LuCI interface with Uhttpd as Webserver (default)
LUCI_DESCRIPTION:=Standard OpenWrt set including full admin with ppp support and the default Bootstrap theme
LUCI_DEPENDS:= \
	+IPV6:luci-proto-ipv6 \
	+luci-app-attendedsysupgrade \
	+luci-app-firewall \
	+luci-app-opkg \
	+luci-mod-admin-full \
	+luci-proto-ppp \
	+luci-theme-bootstrap \
	+rpcd-mod-rrdns \
	+uhttpd \
	+uhttpd-mod-ubus

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
