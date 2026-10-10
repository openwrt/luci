# Copyright (C) 2008-2026 The OpenWrt Project
# Copyright (C) 2026 Manfred Jaider <info@masmbit.com>
#
# This is free software, licensed under the Apache License, Version 2.0.
# See /LICENSE for more information.
#
# luci-app-openvpn-plus : Makefile.standalone

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-openvpn-plus
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Manfred Jaider <info@masmbit.com>

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-openvpn-plus
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for Ready-to-Use OpenVPN Setup (Plus Edition)
  URL:=https://github.com/masmbit/luci-app-openvpn-plus
  DEPENDS:=+luci-base +openvpn-openssl +openssl-util +firewall4 +uclient-fetch
  PKGARCH:=all
endef

define Package/luci-app-openvpn-plus/description
  This package provides an all-in-one web interface to configure OpenVPN servers
  and clients quickly. It includes a setup wizard, a built-in key generator,
  smart firewall protection, port and route checks, DDNS, SSL-VPN, and QR-code
  import/export. With this app, the VPN setup is very simple and intuitive.
endef

# --- Build & Compilation Stage ---
define Build/Compile
	$(INSTALL_DIR) $(PKG_BUILD_DIR)
endef

# --- Package Installation Stage ---
define Package/luci-app-openvpn-plus/install

	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_DATA) ./root/etc/hotplug.d/iface/35-luci-app-openvpn-plus-bootup $(1)/etc/hotplug.d/iface/35-luci-app-openvpn-plus-bootup

	$(INSTALL_DIR) $(1)/etc/hotplug.d/openvpn
	$(INSTALL_DATA) ./root/etc/hotplug.d/openvpn/35-luci-app-openvpn-plus-lifecycle $(1)/etc/hotplug.d/openvpn/35-luci-app-openvpn-plus-lifecycle

	$(INSTALL_DIR) $(1)/etc/openvpn/luci
	$(INSTALL_DATA) ./root/etc/openvpn/luci/server.default.conf $(1)/etc/openvpn/luci/server.default.conf
	$(INSTALL_DATA) ./root/etc/openvpn/luci/client.default.conf $(1)/etc/openvpn/luci/client.default.conf
	$(INSTALL_DATA) ./root/etc/openvpn/luci/default.nft $(1)/etc/openvpn/luci/default.nft

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_DATA) ./root/etc/uci-defaults/35_luci-app-openvpn-plus $(1)/etc/uci-defaults/35_luci-app-openvpn-plus

	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./root/usr/libexec/luci-app-openvpn-plus $(1)/usr/libexec/luci-app-openvpn-plus

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-openvpn-plus.json $(1)/usr/share/luci/menu.d/luci-app-openvpn-plus.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-openvpn-plus.json $(1)/usr/share/rpcd/acl.d/luci-app-openvpn-plus.json
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-openvpn-plus-status.json $(1)/usr/share/rpcd/acl.d/luci-app-openvpn-plus-status.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/vpn
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/vpn/openvpn.js $(1)/www/luci-static/resources/view/vpn/openvpn.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/vpn/openvpn-status.js $(1)/www/luci-static/resources/view/vpn/openvpn-status.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/vpn/openvpn-keygen.js $(1)/www/luci-static/resources/view/vpn/openvpn-keygen.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/vpn/openvpn-wizard.js $(1)/www/luci-static/resources/view/vpn/openvpn-wizard.js

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/status/include
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/status/include/35_openvpn.js $(1)/www/luci-static/resources/view/status/include/35_openvpn.js

endef

# --- Package Uninstallation Stage ---
define Package/luci-app-openvpn-plus/prerm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	rm -rf /etc/openvpn/keys/*default*
	rm -rf /etc/openvpn/luci/*default*
	rm -rf /tmp/run/openvpn.instance*.status
fi
exit 0
endef

# Evaluate the main package into the OpenWrt Buildroot
$(eval $(call BuildPackage,luci-app-openvpn-plus))
