include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Traffic Control
LUCI_DESCRIPTION:=Per-device traffic monitoring, rate limiting (nft/iptables), \
 traffic shaping (tc/HTB), internet blocking, and WiFi MAC filtering.
LUCI_DEPENDS:=+luci-base +trafficctl

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Denis Iusupov <yusdyr@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
