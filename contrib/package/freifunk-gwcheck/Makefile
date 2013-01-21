# Copyright (C) 2011 Manuel Munz <freifunk at somakoma de>
# This is free software, licensed under the Apache 2.0 license.

include $(TOPDIR)/rules.mk

PKG_NAME:=freifunk-gwcheck
PKG_RELEASE:=2

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/freifunk-gwcheck
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Freifunk gateway check script
  DEPENDS:=firewall +ip +iptables-mod-ipopt +olsrd-mod-dyn-gw-plain
endef

define Package/freifunk-gwcheck/description
  This script periodically checks if internet is available via your own gateway. If it detects that it is broken, then the defaultroute is removed from the main table and temporarilly placed in table gw-check until your internet works again. Config file is /etc/config/freifunk-gwcheck.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/freifunk-gwcheck/install
	$(CP) ./files/* $(1)/
	$(CP) ./root/* $(1)/
endef

$(eval $(call BuildPackage,freifunk-gwcheck))
