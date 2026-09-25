include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wificalling-gateway
PKG_VERSION:=1.10.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Smth Dagg <smthdagg@gmail.com>
LUCI_MAINTAINER:=Smth Dagg <smthdagg@gmail.com>

LUCI_TITLE:=LuCI support for per-device Wi-Fi Calling gateway
LUCI_URL:=https://github.com/smthdagg/luci-app-wificalling-gateway
LUCI_DEPENDS:=+luci-base +sing-box +curl +nftables +kmod-nft-tproxy +kmod-nft-socket +ip-full
LUCI_PKGARCH:=all

define Package/luci-app-wificalling-gateway/conffiles
/etc/config/wificalling-gateway
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
