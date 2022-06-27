# Copyright 2022- Duncan Hill <openwrt-dev@cricalix.net>
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for AdguardHome
LUCI_DEPENDS:=+adguardhome +luci-lib-jsonc +luasocket +lyaml
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
