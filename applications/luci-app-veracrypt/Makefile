include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for VeraCrypt
LUCI_DESCRIPTION:=Optional web UI for console VeraCrypt. Uses veracrypt --text only; no VeraCrypt GUI toolkit.
LUCI_DEPENDS:=+luci-base +veracrypt

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Ville Takio <ville+git@takio.fi>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
