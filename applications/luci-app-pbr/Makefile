# Copyright 2017-2023 MOSSDeF, Stan Grishin (stangri@melmac.ca)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-pbr
PKG_LICENSE:=AGPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.1.4
PKG_RELEASE:=16

LUCI_TITLE:=Policy Based Routing Service Web UI
LUCI_DESCRIPTION:=Provides Web UI for Policy Based Routing Service.
LUCI_DEPENDS:=+luci-base +jsonfilter +pbr

PKG_PROVIDES:=luci-app-vpnbypass luci-app-vpn-policy-routing

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	.
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
