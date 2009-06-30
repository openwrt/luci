#
# Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
#
# This is free software, licensed under the Apache 2.0 license.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=sysupgrade-atheros
PKG_RELEASE:=2

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/sysupgrade-atheros
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=Freifunk
  TITLE:=Experimental sysupgrade support for Atheros SoC
  DEPENDS:=@TARGET_atheros
endef

define Package/sysupgrade-atheros/description
  This package implements experimental sysupgrade support for Atheros SoC devices
  like the classic Fonera or the D-Link DIR-300.
  See https://lists.openwrt.org/pipermail/openwrt-devel/2009-June/004499.html for details.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/sysupgrade-atheros/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
  if [ -f /lib/upgrade/kill-ffwatchd.sh ]; then
    rm -f /lib/upgrade/kill-ffwatchd.sh
  fi
}
endef

define Package/sysupgrade-atheros/install
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,sysupgrade-atheros))
