# Copyright 2026 Yang Min Sheng <chinoyan@gmail.com>
# This is free software, licensed under the MIT License.

include $(TOPDIR)/rules.mk

PKG_VERSION:=2.2.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Yang Min Sheng <chinoyan@gmail.com>

LUCI_TITLE:=LuCI support for GeoGuard (country allow-list IPS with login guard)
LUCI_DESCRIPTION:=GeoGuard builds country allow-list ipsets for firewall4 from IP-geolocation feeds, with a custom whitelist, a DDNS no-ban list and a LuCI/SSH login guard.
LUCI_DEPENDS:=+luci-base +firewall4 +wget-ssl +jsonfilter
LUCI_PKGARCH:=all

define Package/luci-app-geoguard/conffiles
/etc/config/geoguard
/etc/nftables.d/10-geoguard-guard.nft
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
