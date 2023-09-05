# Copyright 2021 Nicholas Smith (nicholas@nbembedded.com)
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=Nicholas Smith <nicholas@nbembedded.com>

LUCI_TITLE:=LuCI support for IPSec via Strongswan
LUCI_DESCRIPTION:=Allows configuration of Strongswan IPSec settings
LUCI_DEPENDS:=+strongswan-ipsec

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
