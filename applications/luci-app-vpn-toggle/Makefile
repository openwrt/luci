include $(TOPDIR)/rules.mk

LUCI_TITLE:=VPN Toggle via PBR
LUCI_DEPENDS:=+pbr +luci-base
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-vpn-toggle
PKG_VERSION:=2.1.0
PKG_RELEASE:=1
PKG_MAINTAINER:=Nico Groot <nicopen1@live.nl>
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/postinst
#!/bin/sh
chmod +x /usr/share/vpn-toggle/user-manager 2>/dev/null
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))