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
  SUBMENU:=FFLuCI
  DEPENDS:=+ffluci +iptables-mod-nat
  TITLE:=FFLuCI DHCP-Splash
endef

define Build/Compile
endef

define Package/luci-splash/install
	$(INSTALL_DIR) $(1)/usr/lib/luci-splash/htdocs
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/crontabs
	$(INSTALL_DIR) $(1)/etc/init.d
	
	$(CP) -a ./src/luci-splash/* $(1)/usr/lib/luci-splash/ -R
	$(INSTALL_BIN) ./src/luci-splash/sync.lua $(1)/usr/lib/luci-splash
	$(INSTALL_BIN) ./src/luci-splash/htdocs/cgi-bin/index.cgi $(1)/usr/lib/luci-splash/htdocs/cgi-bin
	$(INSTALL_BIN) ./src/luci_splash.init $(1)/etc/init.d/luci_splash
	
	$(CP) -a ./src/luci_splash.cron $(1)/etc/crontabs/luci_splash
	$(CP) -a ./src/luci_splash.uci $(1)/etc/config/luci_splash
	$(CP) -a ./src/luci_splash_httpd.conf $(1)/etc/
	
	$(CP) -a ./ipkg/conffiles $(1)/CONTROL/conffiles
endef

$(eval $(call BuildPackage,luci-splash))
