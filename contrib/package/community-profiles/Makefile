# Copyright (C) 2011 Manuel Munz <freifunk at somakoma de>
# This is free software, licensed under the Apache 2.0 license.

include $(TOPDIR)/rules.mk

PKG_NAME:=community-profiles
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/community-profiles
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Community profiles
  DEPENDS:=freifunk-common
endef

define Package/community-profiles/description
  These community profiles set defaults for various free network/freifunk communities and are used by wizards like ffwizard and meshwizard.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/community-profiles/install
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,community-profiles))
