include $(TOPDIR)/rules.mk

PKG_VERSION:=20250610
PKG_RELEASE:=4
PKG_NAME:=luci-app-rustdesk-server
PKG_MAINTAINER:=Guilherme Cardoso <luminoso@gmail.com>

LUCI_TITLE:=LuCI support for RustDesk Server
LUCI_DEPENDS:=+luci-base +rpcd +rpcd-mod-ucode
LUCI_PKGARCH:=all
PKG_LICENSE:=Apache-2.0

define Package/$(PKG_NAME)/conffiles
/etc/config/rustdesk-server
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,$(PKG_NAME)))
