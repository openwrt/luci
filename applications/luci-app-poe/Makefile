# Copyright 2026 Pieter Hollander (openwrt@pieterhollander.nl)
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for realtek-poe (PoE control)
LUCI_DEPENDS:=+realtek-poe
LUCI_PKGARCH:=all
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Pieter Hollander <openwrt@pieterhollander.nl>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
