#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=light

LUCI_TITLE:=LuCI Configuration Interface with light Uhttpd as webserver
LUCI_DESCRIPTION:=Standard set including full admin with ppp support, package management and the default Bootstrap theme
LUCI_DEPENDS:= \
	+luci \
	+uhttpd \
	+uhttpd-mod-ubus

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
