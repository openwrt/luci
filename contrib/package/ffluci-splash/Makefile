include $(TOPDIR)/rules.mk

PKG_NAME:=ffluci-splash
PKG_VERSION:=0.1
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install
PKG_BUILD_DEPENDS:=lua-luci

include $(INCLUDE_DIR)/package.mk

define Package/ffluci-splash
  SECTION:=admin
  CATEGORY:=Administration
  SUBMENU:=FFLuCI
  DEPENDS:=+ffluci +iptables-mod-nat +lua-luci
  TITLE:=FFLuCI DHCP-Splash
endef

define Build/Compile
endef

define Package/ffluci-splash/install
	$(INSTALL_DIR) $(1)/usr/lib/luci-splash/htdocs/cgi-bin
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/cron.minutely
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/usr/sbin
	
	$(CP) -a ./src/luci-splash/* $(1)/usr/lib/luci-splash/ -R
	$(INSTALL_BIN) ./src/luci-splash/htdocs/cgi-bin/index.cgi $(1)/usr/lib/luci-splash/htdocs/cgi-bin
	$(INSTALL_BIN) ./src/luci_splash.init $(1)/etc/init.d/luci_splash
	$(INSTALL_BIN) ./src/luci-splash.lua $(1)/usr/sbin/luci-splash
	
	$(INSTALL_BIN) ./src/luci_splash.cron $(1)/etc/cron.minutely/luci-splash
	$(CP) -a ./src/luci_splash.uci $(1)/etc/config/luci_splash
	$(CP) -a ./src/luci_splash_httpd.conf $(1)/etc/
	
	$(CP) -a ./ipkg/conffiles $(1)/CONTROL/conffiles
endef

$(eval $(call BuildPackage,ffluci-splash))
