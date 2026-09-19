include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for VeraCrypt
LUCI_DESCRIPTION:=Optional web UI for console VeraCrypt. Uses veracrypt --text only; no VeraCrypt GUI toolkit.
LUCI_DEPENDS:=+luci-base +veracrypt
LUCI_PKGARCH:=all
LUCI_URL:=https://www.veracrypt.fr/

PKG_LICENSE:=GPL-2.0-only
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Ville Takio <ville+git@takio.fi>

define Package/luci-app-veracrypt/conffiles
/etc/config/veracrypt
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
