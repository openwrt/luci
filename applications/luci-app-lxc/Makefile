#
# Copyright (C) 2026 Paul Donald <newtwen+github@gmail.com>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LXC management Web UI
LUCI_DEPENDS:=@!arc +luci-base +lxc +lxc-attach +lxc-console +lxc-create +liblxc +rpcd-mod-lxc +getopt +!LXC_BUSYBOX_OPTIONS:tar

define Package/luci-app-lxc/conffiles
/etc/config/lxc
endef

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Paul Donald <newtwen+github@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
