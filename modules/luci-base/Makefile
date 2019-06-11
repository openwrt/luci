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
LUCI_DEPENDS:=+lua +luci-lib-nixio +luci-lib-ip +rpcd +libubus-lua +luci-lib-jsonc +liblucihttp-lua

LUCI_LUASRCDIET_VERSION:=1.0.0

PKG_SOURCE_URL:=https://github.com/jirutka/luasrcdiet.git
PKG_SOURCE_VERSION:=f138fc9359821d9201cd6b57cfa2fcbed5b9af97
PKG_SOURCE_SUBDIR:=luasrcdiet-$(LUCI_LUASRCDIET_VERSION)
PKG_SOURCE_PROTO:=git
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_MIRROR_HASH:=a5c9d098549fbef618e6022b701e66c8c6fb16c910e63219adad3a4e71341f72
PKG_LICENSE:=MIT

HOST_BUILD_DIR:=$(BUILD_DIR_HOST)/$(PKG_SOURCE_SUBDIR)

include $(INCLUDE_DIR)/host-build.mk

define Package/luci-base/conffiles
/etc/luci-uploads
/etc/config/luci
/etc/config/ucitrack
endef

include ../../luci.mk

define Host/Configure
endef

define Host/Compile
	$(MAKE) -C src/ clean po2lmo jsmin
endef

define Host/Install
	$(INSTALL_DIR) $(1)/bin
	$(INSTALL_DIR) $(1)/lib/lua/5.1
	$(INSTALL_BIN) src/po2lmo $(1)/bin/po2lmo
	$(INSTALL_BIN) src/jsmin $(1)/bin/jsmin
	$(INSTALL_BIN) $(HOST_BUILD_DIR)/bin/luasrcdiet $(1)/bin/luasrcdiet
	$(CP) $(HOST_BUILD_DIR)/luasrcdiet $(1)/lib/lua/5.1/
endef

$(eval $(call HostBuild))

# call BuildPackage - OpenWrt buildroot signature
