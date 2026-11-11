include $(TOPDIR)/rules.mk

PKG_VERSION:=20260915
PKG_RELEASE:=1
PKG_NAME:=luci-app-rustdesk-server
PKG_MAINTAINER:=Guilherme Cardoso <luminoso@gmail.com>

LUCI_TITLE:=LuCI support for RustDesk Server
LUCI_DEPENDS:=+luci-base +rustdesk-server
LUCI_PKGARCH:=all
PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,$(PKG_NAME)))
