#
# Copyright (C) 2020 Russell Morris <rmorris@rkmorris.us>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Battery Status
LUCI_DESCRIPTION:=Provides a battery charge indicator in LuCI. Currently only supports the HooToo HT-TM05 travel router.

LUCI_DEPENDS:=+luci-base +libiwinfo-lua +rpcd-mod-iwinfo +libi2c +i2c-tools

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature

