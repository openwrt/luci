include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-led-nightmode
PKG_VERSION:=0.5.1
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Mv Go <rapture-ribose6k@icloud.com>

LUCI_TITLE:=LED night mode for OpenWrt
LUCI_DESCRIPTION:=Preserve and restore OpenWrt LED triggers while applying day and night profiles.
LUCI_DEPENDS:=+luci-base +led-nightmode

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
