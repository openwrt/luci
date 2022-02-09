# Copyright 2018-2021 Dirk Brenken (dev@brenken.org)
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for banIP
LUCI_DEPENDS:=+banip +luci-lib-jsonc
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
