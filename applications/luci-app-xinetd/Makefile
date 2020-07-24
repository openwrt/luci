#
# Copyright (C) 2020 TDT AG <development@tdt.de>
#
# This is free software, licensed under the Apache License Version 2.0.
# See https://www.apache.org/licenses/LICENSE-2.0 for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-xinetd
PKG_VERSION:=1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Helge Mader <ma@dev.tdt.de>

# LuCI specific settings
LUCI_TITLE:=LuCI Support for xinetd
LUCI_DEPENDS:=+xinetd
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
