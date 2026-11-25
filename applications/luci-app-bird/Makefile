# SPDX-License-Identifier: MIT

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI configuration for BIRD 2 OSPF
LUCI_DESCRIPTION:=Configure OSPFv2 and OSPFv3 and inspect routes and adjacencies.
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +ucode-mod-fs +bird2 +bird2c
LUCI_PKGARCH:=all
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
