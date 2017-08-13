#
# Copyright (C) 2016 Openwrt.org
# Copyright (C) 2017 Hsing-wang Liao <kuoruan@gmail.com>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-aria2
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

PKG_MAINTAINER:=Hsing-Wang Liao <kuoruan@gmail.com>

LUCI_TITLE:=LuCI Support for Aria2
LUCI_DEPENDS:=+aria2
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/config
help
		$(LUCI_TITLE)
		.
		Version: $(PKG_VERSION)-$(PKG_RELEASE)
		$(PKG_MAINTAINER)
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
