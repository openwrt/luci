# SPDX-License-Identifier: GPL-2.0-only

include $(TOPDIR)/rules.mk

LUCI_NAME:=luci-app-adguardhome
LUCI_MAINTAINER:=George Sapkin <george@sapk.in>
PKG_LICENSE:=GPL-2.0-only

LUCI_TITLE:=LuCI support for AdGuard Home
LUCI_DEPENDS:=+adguardhome +luci-base
LUCI_EXTRA_DEPENDS:=adguardhome (>=0.107.73-r3)
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
