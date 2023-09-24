#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=luci

LUCI_TITLE:=LuCI Configuration Interface
LUCI_DESCRIPTION:=Standard set including full admin with ppp support, package management and the default Bootstrap theme
LUCI_DEPENDS:= \
	+IPV6:luci-proto-ipv6 \
	+luci-proto-ppp \
	+luci-mod-admin-full \
	+rpcd-mod-rrdns \
	+luci-theme-bootstrap \
	+luci-app-firewall \
	+luci-app-opkg

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
