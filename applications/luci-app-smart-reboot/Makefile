include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-smart-reboot
PKG_RELEASE:=6

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)
PO2LMO:=$(STAGING_DIR_HOSTPKG)/bin/po2lmo

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-smart-reboot
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=LuCI support for smart-reboot
	DEPENDS:=+luci-base +smart-reboot
endef

define Package/luci-app-smart-reboot/description
LuCI support for smart-reboot package.
endef

define Build/Compile
	$(INSTALL_DIR) $(PKG_BUILD_DIR)/i18n
	for po in ./po/*/smart-reboot.po; do \
		lang=$$(basename $$(dirname $$$$po)); \
		$(PO2LMO) $$$$po $(PKG_BUILD_DIR)/i18n/smart-reboot.$$$$lang.lmo; \
	done
endef

define Package/luci-app-smart-reboot/install
	$(INSTALL_DIR) $(1)/www
	$(CP) ./htdocs/* $(1)/www/

	$(INSTALL_DIR) $(1)/
	$(CP) ./root/* $(1)/
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	$(CP) $(PKG_BUILD_DIR)/i18n/*.lmo $(1)/usr/lib/lua/luci/i18n/
endef

$(eval $(call BuildPackage,luci-app-smart-reboot))

