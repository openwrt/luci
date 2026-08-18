# SPDX-License-Identifier: GPL-2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for Ariaboard Photonicat 2
LUCI_DEPENDS:=+luci-base +pcat2-mcu +ucode-mod-ubus +jsonfilter
LUCI_PKGARCH:=all

PKG_LICENSE:=GPL-2.0
PKG_MAINTAINER:=Brandon Cleary <cleary.brandon@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,luci-app-photonicat))
