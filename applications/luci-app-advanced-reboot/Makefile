# Copyright 2017-2018 Stan Grishin (stangri@melmac.net)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.net>
PKG_VERSION:=1.0.1-8

LUCI_TITLE:=Advanced Linksys Reboot Web UI
LUCI_URL:=https://docs.openwrt.melmac.net/luci-app-advanced-reboot/
LUCI_DESCRIPTION:=Provides Web UI (found under System/Advanced Reboot) to reboot supported Linksys and ZyXEL routers to\
	an alternative partition. Also provides Web UI to shut down (power off) your device. 	Supported dual-partition\
	routers are listed at https://docs.openwrt.melmac.net/luci-app-advanced-reboot/
LUCI_DEPENDS:=+luci-base +jshn

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
