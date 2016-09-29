#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=ssl

LUCI_TITLE:=Standard OpenWrt set with HTTPS support
LUCI_DEPENDS:=+luci +SSL_DEFAULT_POLARSSL:libustream-polarssl +SSL_DEFAULT_MBEDTLS:libustream-mbedtls +SSL_DEFAULT_OPENSSL:libustream-openssl +SSL_DEFAULT_CYASSL:libustream-cyassl +SSL_DEFAULT_MBEDTLS:px5g-mbedtls +SSL_DEFAULT_POLARSSL:px5g-polarssl +SSL_DEFAULT_OPENSSL:px5g-standalone +SSL_DEFAULT_CYASSL:px5g-standalone

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
