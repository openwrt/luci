include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for LAN Device Management
LUCI_DEPENDS:=+luci-base +rpcd-mod-iwinfo +jshn
LUCI_PKGARCH:=all
LUCI_MAINTAINER:=zhiyong zhang <zhang747@126.com>

PKG_LICENSE:=MIT Apache-2.0
PKG_LICENSE_FILES:=LICENSE htdocs/luci-static/resources/device-manager/device-icons/LICENSE

define Package/luci-app-device-manager/conffiles
/etc/config/device_manager
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
