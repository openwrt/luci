include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-socatg
PKG_VERSION=1.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-socatg
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=socat GUI for LuCI
	PKGARCH:=all
endef

define Package/luci-app-socatg/description
	This package contains LuCI configuration pages for socatg.
endef

define Build/Prepare
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/luci-app-socatg/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/model/cbi
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	
	$(INSTALL_CONF) ./files/root/etc/config/socatg.lua $(1)/etc/config/socatg
	$(INSTALL_BIN) ./files/root/etc/init.d/socatg $(1)/etc/init.d/socatg
	$(INSTALL_DATA) ./files/root/usr/lib/lua/luci/model/cbi/socatg.lua $(1)/usr/lib/lua/luci/model/cbi/socatg.lua
	$(INSTALL_DATA) ./files/root/usr/lib/lua/luci/controller/socatg.lua $(1)/usr/lib/lua/luci/controller/socatg.lua
endef

$(eval $(call BuildPackage,luci-app-socatg))