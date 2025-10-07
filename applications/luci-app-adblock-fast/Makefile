# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright 2023-2025 MOSSDeF, Stan Grishin (stangri@melmac.ca).

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-adblock-fast
PKG_LICENSE:=AGPL-3.0-or-later
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.ca>
PKG_VERSION:=1.2.0
PKG_RELEASE:=20

LUCI_TITLE:=AdBlock-Fast Web UI
LUCI_URL:=https://github.com/stangri/luci-app-adblock-fast/
LUCI_DESCRIPTION:=Provides Web UI for adblock-fast service.
LUCI_DEPENDS:=+luci-base +adblock-fast +jsonfilter

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	.
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
