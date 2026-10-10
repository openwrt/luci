include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for VeraCrypt (lite)
LUCI_DESCRIPTION:=Smaller web UI for console VeraCrypt: mount, unmount and create volumes. Uses veracrypt --text only; no VeraCrypt GUI toolkit.
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +ucode-mod-fs +veracrypt

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Ville Takio <ville+git@takio.fi>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
