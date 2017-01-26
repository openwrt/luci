# Copyright (c) 2017 Stan Grishin (stangri@melmac.net)
# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-vpnbypass
PKG_VERSION:=1.0.0
PKG_RELEASE:=3
PKG_LICENSE:=GPL-3.0+
PKG_MAINTAINER:=Stan Grishin <stangri@melmac.net>
PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-vpnbypass
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=VPN Bypass Web UI
  DEPENDS:=+luci-mod-admin-full +vpnbypass
  PKGARCH:=all
endef

define Package/luci-app-vpnbypass/description
 This package will install VPN Bypass Web UI.
endef

define Build/Prepare
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/luci-app-vpnbypass/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller/
	$(INSTALL_BIN) ./luasrc/controller/vpnbypass.lua  $(1)/usr/lib/lua/luci/controller/vpnbypass.lua
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/model/cbi/
	$(INSTALL_BIN) ./luasrc/model/cbi/vpnbypass.lua $(1)/usr/lib/lua/luci/model/cbi/vpnbypass.lua
endef

$(eval $(call BuildPackage,luci-app-vpnbypass))