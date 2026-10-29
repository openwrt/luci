include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for the UniFi Travel Router LCD (utr-lcd)
LUCI_DEPENDS:=+luci-base +utr-lcd
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Roman Belyakovsky <roman.beliakovskii@smartly.io>

LUCI_DESCRIPTION:=\
	Settings and status page with a screens editor tab (live preview) under \
	Services > LCD Display for the utr-lcd LCD status display.

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
