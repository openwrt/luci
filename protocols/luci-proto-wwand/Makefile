#
# Copyright (C) 2026 André Valentin
#
# This is free software, licensed under the GNU General Public License v2.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Support for QMI/MBIM/NCM cellular modems (wwand)
# This handler uses five resource modules that luci-app-wwand ships —
# wwand.bands, .format, .modemopts, .modemsid and .rpc — so it depends on the
# app rather than carrying a second copy of them.
LUCI_DEPENDS:=+wwand +luci-app-wwand
LUCI_PKGARCH:=all

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=André Valentin <avalentin@marcant.net>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
