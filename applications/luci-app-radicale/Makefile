#
# Copyright (C) 2008-2016 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-radicale

PKG_VERSION:=1.1.0

PKG_RELEASE:=3

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Christian Schoenebeck <christian.schoenebeck@gmail.com>

LUCI_TITLE:=LuCI Support for Radicale CardDAV/CalDAV
LUCI_DEPENDS:=+luci-compat +luci-lib-ipkg +luci-base +radicale

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	.
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
	$(PKG_MAINTAINER)
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
