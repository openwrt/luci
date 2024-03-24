# Copyright 2017-2023 MOSSDeF, Stan Grishin (stangri@melmac.ca)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.1.4-r7

LUCI_TITLE:=Policy Based Routing Service Web UI
LUCI_DESCRIPTION:=Provides Web UI for Policy Based Routing Service.
LUCI_DEPENDS:=+luci-base +jsonfilter +pbr-service
LUCI_PKGARCH:=all

PKG_PROVIDES:=luci-app-vpnbypass luci-app-vpn-policy-routing

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
