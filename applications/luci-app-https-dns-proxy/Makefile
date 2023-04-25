# Copyright 2017-2018 Stan Grishin (stangri@melmac.ca)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=2022-10-15-11

LUCI_TITLE:=DNS Over HTTPS Proxy Web UI
LUCI_DESCRIPTION:=Provides Web UI for DNS Over HTTPS Proxy
LUCI_DEPENDS:=+luci-compat +luci-base +https-dns-proxy
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
