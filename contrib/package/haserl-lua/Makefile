# 
# Copyright (C) 2006 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.

include $(TOPDIR)/rules.mk

PKG_NAME:=haserl-lua
PKG_VERSION:=0.9.24
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.bz2
PKG_SOURCE_URL:=http://dev.leipzig.freifunk.net/svn/ff-luci/trunk/contrib/package-source/ \
	http://firmware.freifunk-halle.net/ffluci/package-source/
PKG_MD5SUM:=b004005594b84e35839b1d5c330f8e03


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
	echo "Replaces: haserl" >> $(1)/CONTROL/control
	echo "Conflicts: haserl" >> $(1)/CONTROL/control
endef

$(eval $(call BuildPackage,haserl-lua))
