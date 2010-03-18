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

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

TARGET_CFLAGS += --std=c99 -D_POSIX_C_SOURCE=200112L -D_XOPEN_SOURCE=500
TARGET_LDFLAGS += -lz -lm -lcrypt

define Package/uhttpd/install
	$(INSTALL_DIR) $(1)/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/uhttpd $(1)/sbin/
endef

$(eval $(call BuildPackage,uhttpd))
