# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2024 ImmortalWrt.org

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for Cloudflared
LUCI_DEPENDS:=+cloudflared
LUCI_PKGARCH:=all
LUCI_DESCRIPTION:=LuCI support for Cloudflared

PKG_MAINTAINER:=<https://github.com/animegasan>
PKG_NAME:=luci-app-cloudflared
PKG_VERSION:=2.0.1-20240113

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature