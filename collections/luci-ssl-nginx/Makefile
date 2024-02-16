#
# Copyright (C) 2008-2016 The LuCI Team
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=ssl

LUCI_TITLE:=LuCI with Nginx and HTTPS support (OpenSSL as SSL backend)
LUCI_DESCRIPTION:=LuCI with OpenSSL as the SSL backend (libustream-openssl). \
 OpenSSL cmd tools (openssl-util) are used by nginx for SSL key generation. \
 
LUCI_DEPENDS:= \
	+luci-nginx \
	+openssl-util \
	+nginx-ssl \
	+nginx-mod-luci-ssl

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
