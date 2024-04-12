# Copyright 2017-2018 Stan Grishin (stangri@melmac.ca)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-https-dns-proxy
PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=2023.11.19
PKG_RELEASE:=r3

LUCI_TITLE:=DNS Over HTTPS Proxy Web UI
LUCI_DESCRIPTION:=Provides Web UI for DNS Over HTTPS Proxy
LUCI_DEPENDS:=+luci-base +https-dns-proxy

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	.
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
