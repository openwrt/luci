include $(TOPDIR)/rules.mk

PKG_NAME:=luci-splash
PKG_VERSION:=0.1
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

include $(INCLUDE_DIR)/package.mk

define Package/luci-splash
  SECTION:=admin
  CATEGORY:=Administration
  SUBMENU:=ffluci
  DEPENDS:=+ffluci
  TITLE:=FFLuCI DHCP-Splash
endef

define Package/luci-splash/install
	$(INSTALL_DIR) $(1)/usr/lib/luci_splash/htdocs
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/init.d
	
	$(CP) -a ./src/luci_splash/* $(1)/usr/lib/luci_splash/ -R
	$(INSTALL_BIN) ./src/luci_splash/sync.lua $(1)/usr/lib/luci_splash
	$(INSTALL_BIN) ./src/luci_splash/htdocs/cgi-bin/index.cgi $(1)/usr/lib/luci_splash/htdocs/cgi-bin
	
	$(CP) -a ./src/luci_splash.init $(1)/etc/init.d/luci_splash
	$(CP) -a ./src/luci_splash.uci $(1)/etc/config/luci_splash
	$(CP) -a ./src/luci_splash_httpd.conf $(1)/etc/
	
	$(CP) -a ./ipkg/conffiles $(1)/CONTROL/conffiles
endef

$(eval $(call BuildPackage,luci-splash))
