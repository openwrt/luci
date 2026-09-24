include $(TOPDIR)/rules.mk

LUCI_TITLE:=LibreSpeed internet speed measurements
LUCI_DEPENDS:=+luci-base +librespeed-common
# The pages schedule and measure per interface, which older releases ignore.
LUCI_EXTRA_DEPENDS:=librespeed-common (>=1.0.0-r3)

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Josef Schlehofer <pepe.schlehofer@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
