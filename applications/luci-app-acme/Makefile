#
# Copyright (C) 2017 Dan Luedtke <mail@danrl.com>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=ACME package - LuCI interface
LUCI_DEPENDS:=+luci-base +luci-app-uhttpd +acme
LUCI_PKGARCH:=all

PKG_MAINTAINER:=Toke Høiland-Jørgensen <toke@toke.dk>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
