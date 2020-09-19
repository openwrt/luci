# Copyright 2017-2020 Dirk Brenken (dev@brenken.org)
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for Travelmate
LUCI_DEPENDS:=+travelmate +luci-lib-jsonc
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
