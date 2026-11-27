# SPDX-License-Identifier: MIT

include $(TOPDIR)/rules.mk

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Yaroslav Vereshchagin <yarik.vereshchagin1996@gmail.com>

LUCI_TITLE:=LuCI support for NES Emulator
LUCI_DESCRIPTION:=Web interface for the NES emulator service
LUCI_DEPENDS:=+luci-base +rpcd +jshn +jsonfilter +cgi-io +nes-emulator
LUCI_PKGARCH:=all
LUCI_MAINTAINER:=$(PKG_MAINTAINER)

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
