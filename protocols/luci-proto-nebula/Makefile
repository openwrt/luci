# Copyright 2021 Stan Grishin (stangri@melmac.ca)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.8.2-r2

LUCI_TITLE:=Support for Nebula
LUCI_DESCRIPTION:=Provides Web UI for Nebula protocol/interface.
LUCI_DEPENDS:=+nebula +nebula-proto
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
