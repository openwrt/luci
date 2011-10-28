#
# Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
#
# This is free software, licensed under the Apache 2.0 license.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=remote-update
PKG_RELEASE:=4

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/remote-update
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Freifunk remote update utility.
  DEPENDS:=@TARGET_atheros||@TARGET_ar71xx||@TARGET_brcm_2_4
endef

define Package/remote-update/description
  The freifunk remote-update utility uses sysupgrade to reflash the currently 
  running firmware while keeping most of the existing configuratio.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/remote-update/install
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,remote-update))
