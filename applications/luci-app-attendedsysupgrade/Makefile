# See /LICENSE for more information.
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for attended sysupgrades
LUCI_DEPENDS:=+luci-base +attendedsysupgrade-common +cgi-io

PKG_MAINTAINER:=Eric Fahlgren <ericfahlgren@gmail.com>, Paul Spooren <paul@spooren.de>
PKG_LICENSE:=GPL-2.0

LUCI_DEFAULT:=y if (BUILDBOT && PACKAGE_luci)

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
