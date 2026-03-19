# Copyright 2021 Nicholas Smith (nicholas@nbembedded.com)
# Copyright (C) 2023 TDT AG <development@tdt.de>
#
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=Nicholas Smith <nicholas@nbembedded.com>, Lukas Voegl <lvoegl@tdt.de>

LUCI_TITLE:=LuCI support for strongSwan via swanctl
LUCI_DESCRIPTION:=Status and configuration for strongSwan based on swanctl
LUCI_DEPENDS:=+strongswan-swanctl +swanmon

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
