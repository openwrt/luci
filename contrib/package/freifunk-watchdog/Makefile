#
# Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=freifunk-watchdog
PKG_RELEASE:=7

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)
PKG_BUILD_DEPENDS := uci

include $(INCLUDE_DIR)/package.mk

define Package/freifunk-watchdog
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=Freifunk
  TITLE:=Freifunk Ad-Hoc watchdog daemon
  DEPENDS:=libuci
endef

define Package/freifunk-watchdog/description
  A watchdog daemon that monitors wireless interfaces to ensure the correct bssid and channel.
  The process will initiate a wireless restart as soon as it detects a bssid or channel mismatch.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Build/Configure
endef

define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR) \
		CC="$(TARGET_CC)" \
		CFLAGS="$(TARGET_CFLAGS) -I$(STAGING_DIR)/usr/include" \
		LDFLAGS="$(TARGET_LDFLAGS)"
endef

define Package/freifunk-watchdog/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/freifunk-watchdog.init $(1)/etc/init.d/freifunk-watchdog
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/ffwatchd $(1)/usr/sbin/
endef

$(eval $(call BuildPackage,freifunk-watchdog))
