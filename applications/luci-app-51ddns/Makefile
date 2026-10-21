include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for 51DDNS remote access
LUCI_URL:=https://github.com/21hkcloud/51ddns-openwrt
LUCI_DESCRIPTION:=Configure and monitor the 51DDNS remote access agent.
LUCI_DEPENDS:=+luci-base +51ddns-agent
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Jinshuan Wang <21hkcloud@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
