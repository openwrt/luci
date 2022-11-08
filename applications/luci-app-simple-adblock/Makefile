# Copyright 2017-2022 Stan Grishin (stangri@melmac.ca)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.9.2-5

LUCI_TITLE:=Simple Adblock Web UI
LUCI_DESCRIPTION:=Provides Web UI for simple-adblock service.
LUCI_DEPENDS:=+luci-mod-admin-full +simple-adblock +jsonfilter
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
