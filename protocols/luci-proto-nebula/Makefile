# Copyright 2021-2024 MOSSDeF, Stan Grishin (stangri@melmac.ca).
# This is free software, licensed under AGPL-3.0-or-later.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-proto-nebula
PKG_LICENSE:=AGPL-3.0-or-later
PKG_MAINTAINER:=
PKG_VERSION:=1.8.2
PKG_RELEASE:=2

LUCI_TITLE:=Support for Nebula
LUCI_DESCRIPTION:=Provides Web UI for Nebula protocol/interface.
LUCI_DEPENDS:=+nebula +nebula-proto

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	.
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
