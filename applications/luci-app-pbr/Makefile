# Copyright 2017-2024 MOSSDeF, Stan Grishin (stangri@melmac.ca).
# This is free software, licensed under AGPL-3.0-or-later.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-pbr
PKG_LICENSE:=AGPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.1.8
PKG_RELEASE:=2

LUCI_TITLE:=Policy Based Routing Service Web UI
LUCI_URL:=https://github.com/stangri/luci-app-pbr/
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
