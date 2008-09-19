# Copyright (C) 2008 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# $Id$

include $(TOPDIR)/rules.mk

PKG_NAME:=luaposix
PKG_VERSION:=5.1.3
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=http://dev.luci.freifunk-halle.net/sources/\
		http://luaforge.net/frs/download.php/3449
PKG_MD5SUM:=4271f321c39d0560d9fbe6ca882a67aa

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/luaposix
  SECTION:=lang
  CATEGORY:=Languages
  SUBMENU:=LUA
  TITLE:=Posix library for Lua
  URL:=http://luaforge.net/projects/luaposix/
  DEPENDS:=+liblua
endef

define Build/Configure
endef

MAKE_FLAGS += \
	OS=Linux

define Package/luaposix/install		
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(CP) $(PKG_BUILD_DIR)/posix.so $(1)/usr/lib/lua
endef

$(eval $(call BuildPackage,luaposix))
