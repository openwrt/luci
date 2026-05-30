include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for Tailscale
LUCI_URL:=https://github.com/tokisaki-galaxy/luci-app-tailscale-community
PKG_DESCRIPTION:=Provides a LuCI Web management interface for Tailscale, allowing viewing status, configuring nodes and daemons.
PKG_MAINTAINER:=Tokisaki-Galaxy <moebest@outlook.jp>
LUCI_DEPENDS:=+tailscale +ip +luci-base
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
