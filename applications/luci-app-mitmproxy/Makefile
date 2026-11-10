# SPDX-License-Identifier: MIT

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for mitmproxy
LUCI_DESCRIPTION:=Web interface to configure, monitor and manage \
	the mitmproxy HTTP/HTTPS proxy.
LUCI_DEPENDS:=+luci-base +luci-compat +mitmproxy
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Alan Chung <alan@9hack.ing>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature