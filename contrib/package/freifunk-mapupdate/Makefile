# Copyright (C) 2011 Manuel Munz <freifunk at somakoma de>
# This is free software, licensed under the Apache 2.0 license.

include $(TOPDIR)/rules.mk

PKG_NAME:=freifunk-mapupdate
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/freifunk-mapupdate
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Update script for freifunkmap
  DEPENDS:=+olsrd-mod-nameservice
endef

define Package/freifunk-mapupdate/description
  This script updates the freifunkmap (also known as the global map, see http://map.berlin.freifunk.net) every hour. Config file is /etc/config/freifunk-mapupdate.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/freifunk-mapupdate/install
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,freifunk-mapupdate))
