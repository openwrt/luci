#
# Copyright (C) 2010 Jo-Philipp Wich <xm@subsignal.org>
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=uhttpd
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/uhttpd
  SECTION:=net
  CATEGORY:=Network
  TITLE:=uHTTPd - tiny, single threaded HTTP server
  DEPENDS:=+liblua +libcyassl
endef

define Package/uhttpd/description
 uHTTPd is a tiny single threaded HTTP server with TLS, CGI and Lua
 support. It is intended as a drop-in replacement for the Busybox
 HTTP daemon.
endef

# hack to use CyASSL headers
TARGET_CFLAGS += -I$(firstword $(wildcard $(BUILD_DIR)/cyassl-*/include))

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Package/uhttpd/install
	$(INSTALL_DIR) $(1)/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/uhttpd $(1)/sbin/
endef

$(eval $(call BuildPackage,uhttpd))
