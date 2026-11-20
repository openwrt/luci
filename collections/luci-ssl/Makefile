#
# Copyright (C) 2008-2020 The LuCI Team
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TYPE:=col
LUCI_BASENAME:=ssl

LUCI_TITLE:=LuCI with HTTPS support (mbedtls as SSL backend)
LUCI_DEPENDS:=+luci-light \
	+libustream-mbedtls \
	+px5g-mbedtls \
	+luci-app-package-manager

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
