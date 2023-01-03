# Copyright 2017-2022 Stan Grishin (stangri@melmac.ca)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.0.1-10

LUCI_TITLE:=Policy Based Routing Service Web UI
LUCI_DESCRIPTION:=Provides Web UI for Policy Based Routing Service.
LUCI_DEPENDS:=+luci-base +jsonfilter +pbr
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
