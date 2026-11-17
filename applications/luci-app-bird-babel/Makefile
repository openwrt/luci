# SPDX-License-Identifier: Apache-2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for BIRD Babel neighbours and history
LUCI_DESCRIPTION:=Shows BIRD Babel neighbours, default route selection and link quality with up to 24 hours of history
LUCI_DEPENDS:=+luci-base +bird-babel-collector

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Robert Foss <rfoss@kernel.org>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
