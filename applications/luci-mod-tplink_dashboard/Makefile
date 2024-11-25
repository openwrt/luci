include $(TOPDIR)/rules.mk

LUCI_TITLE:=TP-Link Dashboard
LUCI_PKGARCH:=all
PKG_VERSION:=1.0.0
PKG_RELEASE:=3

include $(INCLUDE_DIR)/package.mk

define Package/luci-mod-tplink_dashboard
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=$(LUCI_TITLE)
	PKGARCH:=$(LUCI_PKGARCH)
endef

define Build/Configure
	# No configure step needed
endef

define Build/Compile
	# No compile step needed
endef

define Package/luci-mod-tplink_dashboard/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/tplink_dashboard
	$(CP) ./htdocs/luci-static/resources/view/tplink_dashboard/* $(1)/www/luci-static/resources/view/tplink_dashboard/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(CP) ./root/usr/share/luci/menu.d/* $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(CP) ./root/usr/share/rpcd/acl.d/* $(1)/usr/share/rpcd/acl.d/
endef

$(eval $(call BuildPackage,luci-mod-tplink_dashboard))
