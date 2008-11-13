#
# Copyright (C) 2008 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# $Id$

include $(TOPDIR)/rules.mk

PKG_NAME:=axtls
PKG_VERSION:=1.2.0
PKG_RELEASE:=2

PKG_BUILD_DIR=$(BUILD_DIR)/axTLS
PKG_SOURCE:=axTLS-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=@SF/axtls
PKG_MD5SUM:=af805c76c0da1dbfc0c5e6b8dbd6706a

include $(INCLUDE_DIR)/package.mk

# set to 1 to enable debugging
DEBUG=

define Package/libaxtls
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=axTLS embedded SSL library
endef

define Package/axhttpd
  SECTION:=net
  CATEGORY:=Networking
  DEPENDS:=+libaxtls
  TITLE:=axTLS embedded http/https server
endef

define Build/Configure
	$(INSTALL_DIR) $(PKG_BUILD_DIR)/config
	$(CP) ./files/axtls-config $(PKG_BUILD_DIR)/config/.config
	$(CP) ./files/axtls-config.h $(PKG_BUILD_DIR)/config/config.h
endef

TARGET_CFLAGS += $(FPIC)

#define Build/Compile
#	$(MAKE) -C $(PKG_BUILD_DIR)
#endef

define Package/libaxtls/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_BUILD_DIR)/_stage/libaxtls.so* $(1)/usr/lib/
endef

define Package/axhttpd/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/_stage/axhttpd $(1)/usr/sbin/
endef

$(eval $(call BuildPackage,libaxtls))
$(eval $(call BuildPackage,axhttpd))
