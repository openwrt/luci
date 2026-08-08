#
# Copyright (C) 2026 André Valentin
#
# This is free software, licensed under the GNU General Public License v2.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Support for QMI/MBIM/NCM cellular modems (wwand)
# luci-app-wwand provides the shared wwand.bands resource (band/frequency
# helpers) used by this handler; depending on it keeps a single source of
# truth.
LUCI_DEPENDS:=+wwand +luci-app-wwand
LUCI_PKGARCH:=all

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=André Valentin <avalentin@marcant.net>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
