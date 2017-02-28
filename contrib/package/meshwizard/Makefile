# Copyright (C) 2011 Manuel Munz <freifunk at somakoma de>
# This is free software, licensed under the Apache 2.0 license.

include $(TOPDIR)/rules.mk

PKG_NAME:=meshwizard
PKG_RELEASE:=0.3.3

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/meshwizard
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Shell script based wizard for Mesh networks
  DEPENDS:=+firewall
endef

define Package/meshwizard/description
  A shellscript based wizard to simplify the setup of a typical mesh node (e.g. for Freifunk.net)
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/meshwizard/install
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,meshwizard))
