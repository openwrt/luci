# SPDX-License-Identifier: Apache-2.0

include $(TOPDIR)/rules.mk

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Pierre Gaufillet <pierre.gaufillet@bergamote.eu>

LUCI_TITLE:=LuCI support for HA Cluster
LUCI_DEPENDS:=+ha-cluster +luci-base +rpcd

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
