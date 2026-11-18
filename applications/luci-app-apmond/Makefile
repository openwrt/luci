# SPDX-License-Identifier: GPL-2.0-only
#
# Copyright (C) 2026 Rob White <rob@blue-wave.net>
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for ApmonD 2.x
LUCI_DESCRIPTION:=Settings, status, access points, clients and log for ApmonD 2.x, the access point monitoring daemon.
LUCI_DEPENDS:=+luci-base +apmond
LUCI_EXTRA_DEPENDS:=apmond (>=2.0.0)

PKG_VERSION:=2.0.1
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Rob White <rob@blue-wave.net>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
