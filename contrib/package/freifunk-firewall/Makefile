#
# Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
#
# This is free software, licensed under the Apache 2.0 license.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=freifunk-firewall
PKG_RELEASE:=2

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/freifunk-firewall
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=9. Freifunk
  TITLE:=Freifunk Firewall Addon
  DEPENDS:=+firewall
endef

define Package/freifunk-firewall/description
  Various firewall extensions for Freifunk. Includes NAT fixes and advanced settings.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/freifunk-firewall/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
  if ! grep -q /etc/firewall.freifunk /etc/config/firewall; then
    uci add firewall include >/dev/null
    uci set firewall.@include[-1].path=/etc/firewall.freifunk
    uci commit firewall
  fi
}
endef

define Package/freifunk-firewall/install
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,freifunk-firewall))
