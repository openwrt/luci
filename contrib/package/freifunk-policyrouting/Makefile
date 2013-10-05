# Copyright (C) 2011 Manuel Munz <freifunk at somakoma de>
# This is free software, licensed under the Apache 2.0 license.

include $(TOPDIR)/rules.mk

PKG_NAME:=freifunk-policyrouting
PKG_RELEASE:=6

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/freifunk-policyrouting
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Freifunk policy routing addon
  DEPENDS:=+ip
endef

define Package/freifunk-policyrouting/description
  Allows you to send your own traffic via your own default gateway while sending traffic received from the mesh to a gateway in the mesh.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/freifunk-policyrouting/install
	$(CP) ./files/* $(1)/
endef

define Package/freifunk-policyrouting/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/freifunk-policyrouting enabled || /etc/init.d/freifunk-policyrouting enable
	exit 0
}
endef

$(eval $(call BuildPackage,freifunk-policyrouting))
