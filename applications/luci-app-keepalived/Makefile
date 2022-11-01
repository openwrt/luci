#
# Copyright (C) 2022 Jaymin Patel <jem.patel@gmail.com>
#
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=Jaymin Patel <jem.patel@gmail.com>

LUCI_TITLE:=LuCI support for the Keepalived
LUCI_DEPENDS:=+luci-base +keepalived +keepalived-sync
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

