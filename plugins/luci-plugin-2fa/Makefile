#
# Copyright (C) 2026 tokisaki galaxy <moebest@outlook.jp>
# Copyright (C) 2024 Christian Marangi <ansuelsmth@gmail.com>
#
# This is free software, licensed under the Apache License, Version 2.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-plugin-2fa

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=tokisaki galaxy <moebest@outlook.jp>
PKG_DESCRIPTION:=LuCI 2-Factor Authentication Plugin

LUCI_TITLE:=LuCI 2-Factor Authentication
LUCI_DEPENDS:=+luci-base +luci-lib-uqr +ucode-mod-struct +ucode-mod-digest +ucode-mod-log
LUCI_PKGARCH:=all
LUCI_URL:=https://github.com/tokisaki-galaxy/luci-plugin-2fa

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot
