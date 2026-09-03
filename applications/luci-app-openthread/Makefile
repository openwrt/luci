#
# Copyright (c) 2026 The OpenThread Authors
#
# This is free software, licensed under the BSD-3-Clause license.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for OpenThread Border Router
LUCI_DEPENDS:=+luci-base +openthread-br +rpcd-mod-ucode
LUCI_PKGARCH:=all

PKG_LICENSE:=BSD-3-Clause
PKG_MAINTAINER:=Christian Glombek <c.glombek@cosa.systems>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
