#
# Copyright (C) 2024-2026 Alexey Cluster <cluster@cluster.wtf>
#
# This is free software, licensed under the GNU General Public License v3.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for WireGuard Obfuscator
LUCI_DESCRIPTION:=Web interface to configure and control wg-obfuscator, the WireGuard traffic obfuscator.
LUCI_DEPENDS:=+luci-base +wg-obfuscator

PKG_VERSION:=1.6
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-only
PKG_MAINTAINER:=Alexey Cluster <cluster@cluster.wtf>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
