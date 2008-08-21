# Copyright (C) 2008 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# $Id$

include $(TOPDIR)/rules.mk

PKG_NAME:=lpeg
PKG_VERSION:=0.8.1
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=http://www.inf.puc-rio.br/~roberto/lpeg
PKG_MD5SUM:=b6b172bbcdcba5c87b37eef9bb5ae199

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/lpeg
  SECTION:=lang
  CATEGORY:=Languages
  SUBMENU:=LUA
  TITLE:=LPEG - Parsing Expression Grammars
  URL:=http://www.inf.puc-rio.br/~roberto/lpeg.html
  DEPENDS:=+liblua
endef

MAKE_FLAGS += COPT="$(TARGET_CFLAGS) $(FPIC) -I$(STAGING_DIR)/usr/include"

define Build/Configure
endef

define Package/lpeg/install		
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(CP) $(PKG_BUILD_DIR)/{lpeg.so,re.lua} $(1)/usr/lib/lua
endef

$(eval $(call BuildPackage,lpeg))
