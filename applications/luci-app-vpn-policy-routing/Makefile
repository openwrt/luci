# Copyright 2017-2019 Stan Grishin (stangri@melmac.net)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.net>
PKG_VERSION:=0.3.4-8

LUCI_TITLE:=VPN Policy-Based Routing Service Web UI
LUCI_DESCRIPTION:=Provides Web UI for vpn-policy-routing service.
LUCI_DEPENDS:=+luci-compat +luci-mod-admin-full +vpn-policy-routing
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
