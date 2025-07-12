#
# Copyright (C) 2016 Dan Luedtke <mail@danrl.com>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Support for AmneziaWG Web UI
LUCI_DESCRIPTION:=Provides Web UI for AmneziaWG
LUCI_DEPENDS:=+amneziawg-tools +ucode +luci-lib-uqr +resolveip
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Gregory Gullin <garuwex@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
