#
# Copyright 2017 Mauro Mozzarelli <mauro@ezplanet.org>
#
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

# PKG_NAME:=luci-app-ipvs

# Version == major.minor.patch
# increase on new functionality (minor) or patches (patch)
PKG_VERSION:=1.0.0

# Release == build
# increase on changes of translation files
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Mauro Mozzarelli <mauro@ezplanet.org>

# LuCI specific settings
LUCI_TITLE:=IP Virtual Server Load Balancer configuration
LUCI_DEPENDS:=+luci-mod-admin-full +ipvsadm
# LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/config
# shown in make menuconfig <Help>
help
	$(LUCI_TITLE)
	Version: $(PKG_VERSION)-$(PKG_RELEASE)
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
