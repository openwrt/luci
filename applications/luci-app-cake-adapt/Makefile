# SPDX-License-Identifier: GPL-2.0-only

include $(TOPDIR)/rules.mk

PKG_MAINTAINER:=Huy Doan <danghuy1994@gmail.com>
PKG_LICENSE:=GPL-2.0-only

LUCI_TITLE:=LuCI support for cake-adapt
LUCI_DESCRIPTION:=Configure cake-adapt and watch each instance's status
# Any cake-adapt variant provides cake-adapt. OpenWrt turns that into a select
# guarded by this package's symbol and copies cake-adapt's @HAS_BPF_TOOLCHAIN
# under the same guard, which Kconfig rejects as a recursive dependency;
# naming it here, unguarded, avoids that.
LUCI_DEPENDS:=+luci-base +luci-mod-status +cake-adapt @HAS_BPF_TOOLCHAIN
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
