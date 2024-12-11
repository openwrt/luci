include $(TOPDIR)/rules.mk

LUCI_TITLE:=rdash
LUCI_PKGARCH:=all


include $(INCLUDE_DIR)/package.mk

define Package/luci-mod-rdash
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=2. Modules
	TITLE:=$(LUCI_TITLE)
	PKGARCH:=$(LUCI_PKGARCH)
endef

define Build/Configure
	# No configure step needed
endef

define Build/Compile
	# No compile step needed
endef

define Package/luci-mod-rdash/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/rdash
	$(CP) ./htdocs/luci-static/resources/view/rdash/* $(1)/www/luci-static/resources/view/rdash/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(CP) ./root/usr/share/luci/menu.d/* $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(CP) ./root/usr/share/rpcd/acl.d/* $(1)/usr/share/rpcd/acl.d/
endef

$(eval $(call BuildPackage,luci-mod-rdash))
