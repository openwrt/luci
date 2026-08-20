include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wificalling-gateway
PKG_VERSION:=1.8.9
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Smth Dagg <smthdagg@gmail.com>

LUCI_TITLE:=LuCI support for per-device Wi-Fi Calling gateway
LUCI_URL:=https://github.com/smthdagg/luci-app-wificalling-gateway
# The gateway configures nftables itself (firewall.sh) and never talks to
# the firewall4 daemon, so the hard firewall4 dependency is what made opkg
# fail on 18.06-style feeds ("cannot find dependency firewall4").  Depend
# on the actual runtime needs instead; init.d preflights nft/sing-box with
# a readable message on firmwares that cannot run the gateway.
LUCI_DEPENDS:=+luci-base +sing-box +curl +nftables +kmod-nft-tproxy +kmod-nft-socket +ip-full
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk
