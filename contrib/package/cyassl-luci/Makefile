# 
# Copyright (C) 2008 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_BASENAME:=cyassl
PKG_NAME:=$(PKG_BASENAME)-luci
PKG_VERSION:=1.0.3
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_BASENAME)-$(PKG_VERSION).zip
PKG_SOURCE_URL:=http://www.yassl.com/
PKG_MD5SUM:=e9e85a2d78cd535a049e4acce786e42d
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)/$(PKG_BASENAME)-$(PKG_VERSION)
PKG_UNPACK=unzip -d $(BUILD_DIR)/$(PKG_NAME) $(DL_DIR)/$(PKG_SOURCE)

include $(INCLUDE_DIR)/package.mk

define Package/cyassl-luci/Default
  TITLE:=CyaSSL (LuCI embedded flavor)
  URL:=http://www.yassl.com/
endef

define Package/libcyassl-luci
  $(call Package/cyassl-luci/Default)
  SECTION:=libs
  SUBMENU:=SSL
  CATEGORY:=Libraries
  TITLE+= (library)
endef

define Package/libcyassl-luci/description
	CyaSSL is an SSL library optimized for small footprint, both on disk and for memory use.
endef

TARGET_CFLAGS += $(FPIC)

CONFIGURE_ARGS += --without-zlib --enable-fastmath

define Build/InstallDev
	$(INSTALL_DIR) $(1)/usr/include/ctaocrypt
	$(INSTALL_DIR) $(1)/usr/include/cyassl
	$(CP) $(PKG_BUILD_DIR)/ctaocrypt/include/*.h $(1)/usr/include/ctaocrypt
	$(CP) -R $(PKG_BUILD_DIR)/include/* $(1)/usr/include/cyassl/
	
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_BUILD_DIR)/src/.libs/libcyassl.{a,so*} $(1)/usr/lib/
	$(CP) $(PKG_BUILD_DIR)/src/libcyassl.la $(1)/usr/lib/
endef

define Package/libcyassl-luci/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_BUILD_DIR)/src/.libs/libcyassl.so* $(1)/usr/lib/
endef

$(eval $(call BuildPackage,libcyassl-luci))
