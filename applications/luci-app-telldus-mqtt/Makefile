# SPDX-License-Identifier: LGPL-2.1-or-later

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for telldus-mqtt
LUCI_DESCRIPTION:=Status, sensors, switches and broker settings of telldus-mqtt.
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +telldus-mqtt
LUCI_PKGARCH:=all

PKG_MAINTAINER:=Peter Liedholm <peterfromswe884@gmail.com>
PKG_LICENSE:=LGPL-2.1-or-later

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
