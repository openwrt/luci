include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wificalling-gateway
PKG_VERSION:=1.9.6
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

# Without this declaration the shipped /etc/config/wificalling-gateway is a
# plain payload file: opkg/apk upgrade replaces every node credential and
# device policy with the package defaults.  luci.mk supplies nothing here
# implicitly; the other apps that ship a real /etc/config file declare it.
define Package/luci-app-wificalling-gateway/conffiles
/etc/config/wificalling-gateway
endef

# Relative include, like the other applications in this tree: an absolute
# $(TOPDIR)/feeds/luci path breaks when the feed is checked out under a
# different name in feeds.conf.
include ../../luci.mk
