include $(TOPDIR)/rules.mk

PKG_NAME:=luci-addons
PKG_VERSION:=0.2
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk


define Build/Compile
endef


define Package/luci-addons
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=FFLuCI System Addons for Kamikaze
  URL:=http://luci.freifunk-halle.net
endef

define Package/luci-addons/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_DIR) $(1)/sbin
	$(INSTALL_DIR) $(1)/etc/crontabs
	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface

	$(INSTALL_BIN) ./dist/usr/bin/run-parts $(1)/usr/bin
	$(INSTALL_BIN) ./dist/sbin/ffluci-flash $(1)/sbin
	
	$(CP) ./dist/etc/crontabs/root $(1)/etc/crontabs/root
	$(CP) ./dist/etc/hotplug.d/iface/20-aliases $(1)/etc/hotplug.d/iface/20-aliases
endef

$(eval $(call BuildPackage,luci-addons))