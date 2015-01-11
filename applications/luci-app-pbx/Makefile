#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI PBX Administration
LUCI_DEPENDS:= \
	+asterisk18 +asterisk18-app-authenticate +asterisk18-app-disa \
	+asterisk18-app-setcallerid +asterisk18-app-system +asterisk18-chan-gtalk \
	+asterisk18-codec-a-mu +asterisk18-codec-alaw +asterisk18-func-cut \
	+asterisk18-res-clioriginate +asterisk18-func-channel +asterisk18-chan-local \
	+asterisk18-app-record +asterisk18-app-senddtmf +asterisk18-res-crypto

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
