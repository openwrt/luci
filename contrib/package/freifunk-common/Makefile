# Copyright (C) 2011 Manuel Munz <freifunk at somakoma de>
# This is free software, licensed under the Apache 2.0 license.

include $(TOPDIR)/rules.mk

PKG_NAME:=freifunk-common
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/freifunk-common
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Freifunk common files
endef

define Package/freifunk-common/description
  Common files and scripts that are needed to run free wireless mesh networks.
endef

define Package/luci-mod-freifunk/conffiles
/etc/config/freifunk
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/freifunk-common/install
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,freifunk-common))
