#
# Copyright (C) 2008-2015 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-base

LUCI_TYPE:=mod
LUCI_BASENAME:=base

LUCI_TITLE:=LuCI core libraries
LUCI_DEPENDS:=+lua +libuci-lua +luci-lib-nixio +luci-lib-ip +rpcd +libubus-lua

PKG_SOURCE:=LuaSrcDiet-0.12.1.tar.bz2
PKG_SOURCE_URL:=https://luasrcdiet.googlecode.com/files
PKG_MD5SUM:=8a0812701e29b6715e4d76f2f118264a

HOST_BUILD_DIR:=$(BUILD_DIR_HOST)/LuaSrcDiet-0.12.1

include $(INCLUDE_DIR)/host-build.mk

include ../../luci.mk

define Host/Configure
endef

define Host/Compile
	$(MAKE) -C src/ clean po2lmo
	$(MAKE) -C $(HOST_BUILD_DIR) bin/LuaSrcDiet.lua
endef

define Host/Install
	$(INSTALL_DIR) $(STAGING_DIR_HOST)/bin
	$(INSTALL_BIN) src/po2lmo $(STAGING_DIR_HOST)/bin/po2lmo
	$(INSTALL_BIN) $(HOST_BUILD_DIR)/bin/LuaSrcDiet.lua $(STAGING_DIR_HOST)/bin/LuaSrcDiet
endef

$(eval $(call HostBuild))

# call BuildPackage - OpenWrt buildroot signature
