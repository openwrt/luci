#
# Copyright (C) 2018 Jo-Philipp Wich <jo@mein.io>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=Package management application
LUCI_DEPENDS:=+luci-base

PKG_MAINTAINER:=Jo-Philipp Wich <jo@mein.io>

PKG_PROVIDES:=luci-app-opkg

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
