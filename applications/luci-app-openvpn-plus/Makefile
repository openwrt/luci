# Copyright (C) 2008-2026 The OpenWrt Project
# Copyright (C) 2026 Manfred Jaider <info@masmbit.com>
#
# This is free software, licensed under the Apache License, Version 2.0.
# See /LICENSE for more information.
#
# luci-app-openvpn-plus : Makefile.upstream

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-openvpn-plus
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Manfred Jaider <info@masmbit.com>

LUCI_TITLE:=LuCI support for Ready-to-Use OpenVPN Setup (Plus Edition)
LUCI_DEPENDS:=+luci-base +openvpn-openssl +openssl-util +firewall4 +uclient-fetch
LUCI_PKGARCH:=all

define Package/luci-app-openvpn-plus/description
  This package provides an all-in-one web interface to configure OpenVPN servers
  and clients quickly. It includes a setup wizard, a built-in key generator,
  smart firewall protection, port and route checks, DDNS, SSL-VPN, and QR-code
  import/export. With this app, the VPN setup is very simple and intuitive.
endef

# --- LuCI custom installation hook for executable permissions ---
define LuCI/Install/Extra
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./root/usr/libexec/luci-app-openvpn-plus $(1)/usr/libexec/luci-app-openvpn-plus
endef

# --- Package uninstall cleanup  ---
define Package/luci-app-openvpn-plus/prerm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	rm -rf /etc/openvpn/keys/*default*
	rm -rf /etc/openvpn/luci/*default*
	rm -rf /tmp/run/openvpn.instance*.status
fi
exit 0
endef

# 3. LuCI build engine
include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

