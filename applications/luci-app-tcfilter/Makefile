# SPDX-License-Identifier: GPL-2.0-only

include $(TOPDIR)/rules.mk

PKG_MAINTAINER:=Mark Abe <github@mab.wien>
PKG_LICENSE:=GPL-2.0-only

LUCI_TITLE:=LuCI support for tcfilter
LUCI_DESCRIPTION:=Manage persistent tc ingress (flower) filters and watch their hardware-offload status
LUCI_DEPENDS:=+luci-base +tcfilter
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
