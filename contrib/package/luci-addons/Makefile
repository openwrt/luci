include $(TOPDIR)/rules.mk

PKG_NAME:=luci-addons
PKG_VERSION:=0.3
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk


define Build/Compile
endef


define Package/luci-addons
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=LuCI System Addons for Kamikaze
  URL:=http://luci.freifunk-halle.net
endef

define Package/luci-addons/conffiles
/etc/config/luci_hosts
/etc/config/luci_ethers
endef

define Package/luci-addons/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_DIR) $(1)/sbin
	$(INSTALL_DIR) $(1)/etc/crontabs
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/etc/config

	$(INSTALL_BIN) ./dist/usr/bin/run-parts $(1)/usr/bin
	$(INSTALL_BIN) ./dist/sbin/luci-flash $(1)/sbin
	$(INSTALL_BIN) ./dist/etc/init.d/luci_fixtime $(1)/etc/init.d
	$(INSTALL_BIN) ./dist/etc/init.d/luci_ethers $(1)/etc/init.d
	$(INSTALL_BIN) ./dist/etc/init.d/luci_hosts $(1)/etc/init.d

	$(INSTALL_CONF) ./dist/etc/config/luci_ethers $(1)/etc/config
	$(INSTALL_CONF) ./dist/etc/config/luci_hosts $(1)/etc/config

	$(CP) ./dist/etc/crontabs/root $(1)/etc/crontabs/root
endef

$(eval $(call BuildPackage,luci-addons))
