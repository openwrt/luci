# Copyright (C) 2008 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# $Id$

include $(TOPDIR)/rules.mk

PKG_NAME:=bitlib
PKG_VERSION:=25
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=http://dev.luci.freifunk-halle.net/sources/\
		http://luaforge.net/frs/download.php/3065
PKG_MD5SUM:=18f124c80c685f2269296a7172e600fe

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/bitlib
  SECTION:=lang
  CATEGORY:=Languages
  SUBMENU:=LUA
  TITLE:=bit manipulation library
  URL:=http://luaforge.net/projects/bitlib
  DEPENDS:=+liblua
endef

define Build/Configure
endef

define Build/Compile
	$(CP) $(PKG_BUILD_DIR)/config.h.in $(PKG_BUILD_DIR)/config.h
	$(TARGET_CC) $(TARGET_CFLAGS) -DHAVE_CONFIG_H -I$(PKG_BUILD_DIR) -Wall -pedantic \
	 -I$(STAGING_DIR)/usr/include/ -c $(PKG_BUILD_DIR)/lbitlib.c -fPIC -o $(PKG_BUILD_DIR)/lbitlib.o
	$(TARGET_CC) $(TARGET_LDFLAGS) -shared $(PKG_BUILD_DIR)/lbitlib.o -o $(PKG_BUILD_DIR)/bit.so
endef

define Package/bitlib/install		
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(CP) $(PKG_BUILD_DIR)/bit.so $(1)/usr/lib/lua
endef

$(eval $(call BuildPackage,bitlib))
