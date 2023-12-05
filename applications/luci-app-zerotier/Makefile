# See /LICENSE for more information.
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for Zerotier
LUCI_DEPENDS:=+zerotier +jsonfilter +ucode
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-zerotier
PKG_VERSION:=0.0.1
PKG_RELEASE:=$(COMMITCOUNT)

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature