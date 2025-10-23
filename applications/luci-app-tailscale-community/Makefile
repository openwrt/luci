include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for Tailscale
PKG_DESCRIPTION:=Provides a LuCI Web management interface for Tailscale, allowing viewing status, configuring nodes and daemons.
PKG_VERSION:=2.1.0
PKG_RELEASE:=1
PKG_MAINTAINER:=Tokisaki-Galaxy <moebest@outlook.jp>
LUCI_DEPENDS:=+tailscale +ip +luci-base
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
