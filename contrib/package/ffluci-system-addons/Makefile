include $(TOPDIR)/rules.mk

PKG_NAME:=ffluci-system-addons
PKG_VERSION:=0.1
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/ffluci-splash
  SECTION:=admin
  CATEGORY:=Administration
  SUBMENU:=FFLuCI
  TITLE:=FFLuCI System Addons for Kamikaze
endef

define Build/Compile
endef

define Package/ffluci-system-addons/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_DIR) $(1)/etc/crontabs
	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface

	$(INSTALL_BIN) ./src/run-parts $(1)/usr/bin
	$(CP) ./src/root.crontab $(1)/etc/crontabs/root
	$(CP) ./src/hotplug.d-20-aliases $(1)/etc/hotplug.d/iface/20-aliases
endef

$(eval $(call BuildPackage,ffluci-system-addons))
