#
# Copyright (C) 2016 Dan Luedtke <mail@danrl.com>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_MAINTAINER:=Amnezia Admin <admin@amnezia.org>
PKG_VERSION:=0.0.1-1
LUCI_TITLE:=AmneziaWG Web UI
LUCI_DESCRIPTION:=Provides Web UI for AmneziaWG
LUCI_DEPENDS:=+luci-base +amneziawg-tools +ucode
LUCI_PKGARCH:=all

PKG_PROVIDES:=luci-proto-amneziawg

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
