include $(TOPDIR)/rules.mk

LUCI_TITLE:=VPN Toggle via PBR
LUCI_DEPENDS:=+pbr +luci-base
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-vpn-toggle
PKG_VERSION:=1.0.10
PKG_RELEASE:=1
PKG_MAINTAINER:=The_Nicolini <nicopen1@live.nl>
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE
PKG_SOURCE_URL:=https://github.com/DeHarryPotter/luci-app-vpn-toggle.git
PKG_SOURCE_PROTO:=git
PKG_SOURCE_VERSION:=f2d4e274e07c6a0482a48a798b994e9b2e619739

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature