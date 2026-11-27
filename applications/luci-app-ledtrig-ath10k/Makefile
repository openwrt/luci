#
# Copyright (C) 2022 TDT AG <development@tdt.de>
#
# This is free software, licensed under the Apache License Version 2.0.
# See https://www.apache.org/licenses/LICENSE-2.0 for more information.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:= LuCI Support for ath10k led trigger
LUCI_PKGARCH:=all
LUCI_DEPENDS:=@(ATH10K_LEDS||ATH10K-CT_LEDS)

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
