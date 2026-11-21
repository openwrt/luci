include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-routelink
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=Yongjun Tang <tsix2019@gmail.com>

# the translation package follows the app version instead of file times
PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)

LUCI_TITLE:=LuCI support for RouteLink
LUCI_DEPENDS:=+routelinkd
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
