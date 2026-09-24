#
# Copyright 2019-2020 ZHANG Zhao <Zhao.Zhang2@etu.univ-grenoble-alpes.fr>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Dashboard Pages
LUCI_DEPENDS:=+luci-base +libiwinfo +ucode-mod-uloop

PKG_BUILD_DEPENDS:=iwinfo
PKG_LICENSE:=Apache-2.0

define Package/luci-mod-dashboard/conffiles
/etc/config/dashboard
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

