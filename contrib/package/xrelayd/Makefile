include $(TOPDIR)/rules.mk

PKG_NAME:=xrelayd
PKG_VERSION:=0.2.1pre2
PKG_RELEASE:=1

PKG_SOURCE_URL:=http://znerol.ch/files
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_MD5SUM:=05f242295fa864bb3b0b7f0712b4dfa3

PKG_CAT:=zcat
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

PKG_BUILD_DEPENDS:=libxyssl

include $(INCLUDE_DIR)/package.mk

define Package/xrelayd
  SECTION:=net
  CATEGORY:=Network
  DEPENDS:=+libxyssl
  TITLE:=stunnel replacement based on xyssl
  URL:=http://znerol.ch/
endef

define Package/xrelayd/description
  stunnel replacement based on xyssl
endef

define Build/Configure
endef

define Build/Compile
	rm -rf $(PKG_INSTALL_DIR)
	mkdir -p $(PKG_INSTALL_DIR)
	$(MAKE) -C $(PKG_BUILD_DIR) \
		$(TARGET_CONFIGURE_OPTS) \
		CC="$(TARGET_CC)" \
		LD="$(TARGET_CC)" \
		CFLAGS="$(strip $(TARGET_CFLAGS))" \
		CPPFLAGS="$$$$CPPFLAGS -I$(STAGING_DIR)/usr/include" \
		LDFLAGS="-L$(STAGING_DIR)/usr/lib" \
		prefix="$(PKG_INSTALL_DIR)/usr"
	mkdir -p $(PKG_INSTALL_DIR)/usr/bin
	$(CP) $(PKG_BUILD_DIR)/xrelayd $(PKG_INSTALL_DIR)/usr/bin 
endef

define Package/xrelayd/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/xrelayd $(1)/usr/bin
	$(RSTRIP) $(1)/usr/bin/xrelayd
endef

#mostlyclean:
#	make -C $(PKG_BUILD_DIR) clean
#	rm $(PKG_BUILD_DIR)/.built

$(eval $(call BuildPackage,xrelayd))
