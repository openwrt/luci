#
# Copyright (C) 2016 The LuCI Team
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=ssl-openssl

LUCI_TITLE:=LuCI with HTTPS support (OpenSSL as SSL backend)
LUCI_DESCRIPTION:=LuCI with OpenSSL as the SSL backend (libustream-openssl). \
 Note: px5g still requires libpolarssl
LUCI_DEPENDS:=+luci +libustream-openssl +px5g

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
