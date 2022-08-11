#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=NIXIO POSIX library
LUCI_DEPENDS:=+liblua +LUCI_NIXIO_OPENSSL:libopenssl +LUCI_NIXIO_WOLFSSL:libwolfssl

PKG_LICENSE:=Apache-2.0
PKG_CONFIG_DEPENDS:= \
	CONFIG_LUCI_NIXIO_NOTLS \
	CONFIG_LUCI_NIXIO_WOLFSSL \
	CONFIG_LUCI_NIXIO_OPENSSL

define Package/luci-lib-nixio/config
	choice
		prompt "TLS Provider"
		default LUCI_NIXIO_NOTLS

		config LUCI_NIXIO_NOTLS
			bool "Disabled"

		config LUCI_NIXIO_WOLFSSL
			bool "wolfSSL"

		config LUCI_NIXIO_OPENSSL
			bool "OpenSSL"
	endchoice
endef

export NIXIO_TLS :=

ifneq ($(CONFIG_LUCI_NIXIO_WOLFSSL),)
	NIXIO_TLS:=wolfssl
endif

ifneq ($(CONFIG_LUCI_NIXIO_OPENSSL),)
	NIXIO_TLS:=openssl
endif

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
