# Copyright (C) 2026 OpenWrt.org
# This is free software, licensed under the Apache License, Version 2.0.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=SFP/QSFP Transceiver Diagnostics
LUCI_DEPENDS:=+luci-base +ethtool-full  # requires ethtool >= 7.0 for --json support
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0
PKG_VERSION:=1.0
PKG_MAINTAINER:=Meng Zhuo <mengzhuo@iscas.ac.cn>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
