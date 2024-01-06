#
# Copyright 2008 Steven Barth <steven@midlink.org>
# Copyright 2008 Jo-Philipp Wich <jow@openwrt.org>
# Copyright 2013 Manuel Munz <freifunk at somakoma dot de>
# Copyright 2014-2018 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
#
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Ansuel Smith <ansuelsmth@gmail.com>

LUCI_TITLE:=LuCI Support for Dynamic DNS Client (ddns-scripts)
LUCI_DEPENDS:=+luci-base +luci-lua-runtime +ddns-scripts

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
