# SPDX-License-Identifier: GPL-2.0-or-later
# Copyright (C) 2026 Jia Liu <support@51sdwan.com>

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-51sdwan
LUCI_TITLE:=LuCI support for 51SDWAN
LUCI_URL:=https://www.51sdwan.com/en/openwrt
LUCI_DESCRIPTION:=Web interface for the 51SDWAN OpenWrt edge agent.
LUCI_DEPENDS:=+luci-base +51sdwan
LUCI_PKGARCH:=all
PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=Jia Liu <support@51sdwan.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
