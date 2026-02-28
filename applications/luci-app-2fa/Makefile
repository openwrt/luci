#
# Copyright (C) 2026 tokisaki galaxy <moebest@outlook.jp>
# Copyright (C) 2024 Christian Marangi <ansuelsmth@gmail.com>
#
# This is free software, licensed under the Apache License, Version 2.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-2fa

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=tokisaki galaxy <moebest@outlook.jp>
PKG_DESCRIPTION:=LuCI 2-Factor Authentication Plugin

LUCI_TITLE:=LuCI 2-Factor Authentication
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all
LUCI_URL:=https://github.com/tokisaki-galaxy/luci-app-2fa

define Package/luci-app-2fa/conffiles
/etc/config/2fa
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot
