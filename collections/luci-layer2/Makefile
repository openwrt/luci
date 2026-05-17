#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=layer2

LUCI_TITLE:=LuCI interface for layer-2 devices, using Uhttpd (layer-2)
LUCI_DESCRIPTION:=Layer-2 OpenWrt set including admin support and the default Bootstrap theme
LUCI_DEPENDS:= \
	+luci-mod-admin-full \
	+luci-theme-bootstrap \
	+rpcd-mod-rrdns \
	+uhttpd \
	+uhttpd-mod-ubus

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
