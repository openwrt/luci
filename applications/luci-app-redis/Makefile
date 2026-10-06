# Copyright (C) 2026 KotobaWakusei <kotobawakusei@users.noreply.github.com>
#
# This is free software, licensed under the MIT License.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_MAINTAINER:=KotobaWakusei <kotobawakusei@users.noreply.github.com>

LUCI_TITLE:=LuCI Redis Management
LUCI_DESCRIPTION:=LuCI web interface for managing Redis server on OpenWrt.
LUCI_DEPENDS:=+luci-base +luci-lua-runtime +redis-server +redis-cli
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
