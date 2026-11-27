include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-singbox
PKG_VERSION:=1.1.1
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=Dmitriy Stroganov <strodi@yandex.ru>

LUCI_TITLE:=sing-box VPN — VLESS+REALITY management interface
LUCI_DESCRIPTION:=Web interface for sing-box proxy with VLESS+REALITY support, \
	traffic splitting, geosite rules, subscription import, and real-time \
	monitoring via Clash API.

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=$(LUCI_TITLE)
  DEPENDS:=+sing-box +luci-base +jq
  PKGARCH:=all
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/usr/share/singbox
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DIR) $(1)/usr/share/ucode/rpc
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/singbox

	$(INSTALL_DATA) ./files/etc/config/singbox                   $(1)/etc/config/singbox
	$(INSTALL_BIN)  ./files/etc/init.d/sing-box                  $(1)/etc/init.d/sing-box
	$(INSTALL_BIN)  ./files/etc/uci-defaults/singbox-migrate     $(1)/etc/uci-defaults/singbox-migrate
	$(INSTALL_BIN)  ./files/usr/share/singbox/generate-config.sh $(1)/usr/share/singbox/generate-config.sh
	$(INSTALL_BIN)  ./files/usr/share/singbox/status.sh          $(1)/usr/share/singbox/status.sh
	$(INSTALL_BIN)  ./files/usr/share/singbox/update-subscription.sh $(1)/usr/share/singbox/update-subscription.sh
	$(INSTALL_BIN)  ./files/usr/share/singbox/tail-log.sh        $(1)/usr/share/singbox/tail-log.sh
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/luci-app-singbox.json   $(1)/usr/share/rpcd/acl.d/luci-app-singbox.json
	$(INSTALL_DATA) ./files/usr/share/luci/menu.d/luci-app-singbox.json  $(1)/usr/share/luci/menu.d/luci-app-singbox.json
	$(INSTALL_BIN)  ./files/usr/share/ucode/rpc/singbox.uc       $(1)/usr/share/ucode/rpc/singbox.uc

	$(INSTALL_DATA) ./files/www/luci-static/resources/view/singbox/overview.js $(1)/www/luci-static/resources/view/singbox/overview.js
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/singbox/servers.js  $(1)/www/luci-static/resources/view/singbox/servers.js
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/singbox/routing.js  $(1)/www/luci-static/resources/view/singbox/routing.js
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/singbox/logs.js     $(1)/www/luci-static/resources/view/singbox/logs.js
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/singbox/settings.js $(1)/www/luci-static/resources/view/singbox/settings.js
endef

# Files preserved across upgrade — opkg asks before overwriting if local copy differs.
define Package/$(PKG_NAME)/conffiles
/etc/config/singbox
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
exit 0
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
