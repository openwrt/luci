#
# Copyright (C) 2025 OpenWrt LuCI community
#
# This is free software, licensed under the Apache License Version 2.0.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI LED trigger: ping target
LUCI_DESCRIPTION:=LED trigger that indicates reachability of a host. Configurable: LED on when reachable or when unreachable.
LUCI_DEPENDS:=+luci-base

PKG_VERSION:=1.0.0
PKG_RELEASE:=2
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=LuCI community <luci@lists.openwrt.org>

include ../../luci.mk

define Package/$(PKG_NAME)/install
	$(call Package/$(PKG_NAME)/install/default,$(1))
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/root/etc/init.d/ledtrig-ping $(1)/etc/init.d/ledtrig-ping
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/root/usr/libexec/ledtrig-ping $(1)/usr/libexec/ledtrig-ping
endef

# call BuildPackage - OpenWrt buildroot signature
