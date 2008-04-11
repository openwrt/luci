include $(TOPDIR)/rules.mk

PKG_NAME:=ffluci
PKG_REV:=HEAD
PKG_VERSION:=0.2+svn$(PKG_REV)
PKG_RELEASE:=1
PKG_BRANCH:=trunk

PKG_SOURCE_PROTO:=svn
PKG_SOURCE_VERSION:=$(PKG_REV)
PKG_SOURCE_URL:=https://dev.leipzig.freifunk.net/svn/ff-luci/$(PKG_BRANCH)
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

MAKE_ACTION:=compile LUAC=$(BUILD_DIR_HOST)/lua-luci/luac

include $(INCLUDE_DIR)/package.mk

define Package/ffluci
  SECTION:=admin
  CATEGORY:=Administration
  TITLE:=FFLuCI
  DEPENDS:=+luaposix +haserl-lua
  MAINTAINER:=Steven Barth <steven-at-midlink-dot-org>
endef

define Build/Configure
endef

define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR)/core $(MAKE_ACTION)
	$(MAKE) -C $(PKG_BUILD_DIR)/module/admin-core $(MAKE_ACTION)
	$(MAKE) -C $(PKG_BUILD_DIR)/module/public-core $(MAKE_ACTION)
endef

define Package/ffluci/install		
	$(INSTALL_DIR) $(1)/usr/lib/lua/ffluci
	$(INSTALL_DIR) $(1)/www/cgi-bin
	$(INSTALL_DIR) $(1)/www/ffluci
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/sbin
	
	$(CP) $(PKG_BUILD_DIR)/core/dist/* $(1)/usr/lib/lua/ -R
	$(CP) $(PKG_BUILD_DIR)/core/contrib/uci/luci $(1)/etc/config/luci
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/core/contrib/ffluci $(1)/www/cgi-bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/core/contrib/ffluci-upload $(1)/www/cgi-bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/core/contrib/index.cgi $(1)/www/cgi-bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/core/contrib/index.html $(1)/www
	
	$(CP) $(PKG_BUILD_DIR)/themes/fledermaus/contrib/media $(1)/www/ffluci/ -R
		
	$(CP) $(PKG_BUILD_DIR)/module/admin-core/dist/* $(1)/usr/lib/lua/ffluci/ -R
	$(CP) $(PKG_BUILD_DIR)/module/admin-core/contrib/uci/luci_fw $(1)/etc/config/luci_fw
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/module/admin-core/contrib/init.d/luci_fw $(1)/etc/init.d/luci_fw
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/module/admin-core/contrib/ffluci-flash $(1)/sbin
	
	$(CP) $(PKG_BUILD_DIR)/module/public-core/dist/* $(1)/usr/lib/lua/ffluci/ -R
	$(CP) $(PKG_BUILD_DIR)/module/public-core/contrib/media $(1)/www/ffluci/ -R
	
	$(CP) -a ./ipkg/ffluci.postinst $(1)/CONTROL/postinst
	$(CP) -a ./ipkg/conffiles $(1)/CONTROL/conffiles
	rm $(DL_DIR)/$(PKG_SOURCE)
endef

$(eval $(call BuildPackage,ffluci))