# SPDX-License-Identifier: MIT
#
# Copyright (C) 2026 Smth Dagg <smthdagg@gmail.com>

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for per-device Wi-Fi Calling gateway
LUCI_URL:=https://github.com/smthdagg/luci-app-wificalling-gateway
LUCI_DEPENDS:=+luci-base +sing-box +firewall4 +kmod-nft-tproxy +kmod-nft-socket +ip-full
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Smth Dagg <smthdagg@gmail.com>

define Package/luci-app-wificalling-gateway/conffiles
/etc/config/wificalling-gateway
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
