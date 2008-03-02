include $(TOPDIR)/rules.mk

PKG_NAME:=ffluci
PKG_VERSION:=0.1
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

MAKE_ACTION:=dist-source

include $(INCLUDE_DIR)/package.mk

define Package/ffluci
  SECTION:=admin
  CATEGORY:=Administration
  TITLE:=FFLuCI
  DEPENDS:=+liblua +luafilesystem +haserl
  MAINTAINER:=Steven Barth <steven-at-midlink-dot-org>
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/ -R
endef

define Build/Configure
endef

define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR) dist-source
endef

define Package/ffluci/install		
	$(INSTALL_DIR) $(1)/usr/lib/lua
	$(INSTALL_DIR) $(1)/www/cgi-bin
	$(CP) $(PKG_BUILD_DIR)/dist/* $(1)/usr/lib/lua/ -R
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/contrib/ffluci $(1)/www/cgi-bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/contrib/index.cgi $(1)/www/cgi-bin
	$(CP) -a ./ipkg/ffluci.postinst $(1)/CONTROL/postinst
endef

$(eval $(call BuildPackage,ffluci))
