# Copyright (c) 2017 Stan Grishin (stangri@melmac.net)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0+
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.net>

LUCI_TITLE:=OpenVPN Policy-Based Routing Service Web UI
LUCI_DEPENDS:=+openvpn-policy-routing
LUCI_PKGARCH:=all
PKG_RELEASE:=6

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
