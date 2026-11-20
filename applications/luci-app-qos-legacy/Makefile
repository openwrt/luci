#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Configuration for the ancient qos-scripts package
LUCI_DESCRIPTION:=Configuration for the ancient qos-scripts package \
  targeting legacy iptables based environment. \
  (Note: SQM or qosify are more modern QoS packages)
LUCI_DEPENDS:=+luci-base +qos-scripts

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Paul Donald <newtwen+github@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
