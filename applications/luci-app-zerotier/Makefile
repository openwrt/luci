# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2022 ImmortalWrt.org

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for Zerotier
LUCI_DEPENDS:=+zerotier
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-zerotier
PKG_RELEASE:=$(COMMITCOUNT)

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature


