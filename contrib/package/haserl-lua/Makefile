# 
# Copyright (C) 2006 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# $Id: Makefile 1719 2008-03-24 16:07:38Z Cyrus $

include $(TOPDIR)/rules.mk

PKG_NAME:=haserl-lua
PKG_VERSION:=0.9.23
PKG_RELEASE:=1

PKG_SOURCE:=haserl-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=@SF/haserl
PKG_MD5SUM:=31d1f505afe3ba1b351e18612aa57a70


include $(INCLUDE_DIR)/package.mk

define Package/haserl-lua
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=A CGI wrapper to embed shell scripts in HTML documents
  URL:=http://haserl.sourceforge.net/
  DEPENDS:=+liblua
endef

CONFIGURE_ARGS += \
        --with-lua

define Package/haserl-lua/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(STRIP) $(PKG_BUILD_DIR)/src/haserl
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/src/haserl $(1)/usr/bin/
endef

$(eval $(call BuildPackage,haserl-lua))
