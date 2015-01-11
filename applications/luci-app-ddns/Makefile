#
# Copyright (C) 2008-2015 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for Dynamic DNS (ddns-scripts)
LUCI_DEPENDS:=+ddns-scripts +luci-mod-admin-full

PKG_NAME:=luci-app-ddns
PKG_VERSION:=2.1.0
PKG_RELEASE:=4
PKG_LICENSE:=Apache-2.0
PKGARCH:=all

PKG_MAINTAINER:=Christian Schoenebeck <christian.schoenebeck@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
