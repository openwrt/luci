#
# Copyright (C) 2023 Jo-Philipp Wich <jo@mein.io>
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=uwsd
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL=https://github.com/jow-/uwsd.git
PKG_SOURCE_DATE:=2023-08-31
PKG_SOURCE_VERSION:=95f766b42db2ec7c3fca938c216abb92106a84a8
PKG_MIRROR_HASH:=defd95a7cad27f0931db49b7487fe33587dcbea7f677f8a1726ab02ef6f9feaf
PKG_MAINTAINER:=Jo-Philipp Wich <jo@mein.io>
PKG_LICENSE:=ISC
PKG_LICENSE_FILES:=LICENSE

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/cmake.mk

define Package/uwsd/default
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  TITLE:=uwsd - HTTP and WebSocket server with ucode scripting
  PROVIDES:=uwsd
  DEPENDS:=+libucode +libubox
endef

define Package/uwsd/description/default
 uwsd is a small single threaded HTTP and WebSocket server with TLS
 and ucode scripting as well as basic proxying support.
endef

define Package/uwsd/conffiles/default
/etc/config/uwsd
/etc/uwsd.crt
/etc/uwsd.key
endef


define Package/uwsd-openssl
  $(Package/uwsd/default)
  TITLE+= using OpenSSL
  VARIANT:=openssl
  CONFLICTS:=uwsd-mbedtls
  DEPENDS+=+libopenssl
endef

define Package/uwsd-mbedtls
  $(Package/uwsd/default)
  TITLE+= using MbedTLS
  VARIANT:=mbedtls
  DEPENDS+=+libmbedtls
endef

Package/uwsd-openssl/description:=$(Package/uwsd/description/default)
Package/uwsd-openssl/conffiles:=$(Package/uwsd/conffiles/default)

define Package/uwsd-openssl/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/sbin/uwsd $(1)/usr/sbin/uwsd
endef

Package/uwsd-mbedtls/description:=$(Package/uwsd/description/default)
Package/uwsd-mbedtls/conffiles:=$(Package/uwsd/conffiles/default)

define Package/uwsd-mbedtls/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/uwsd.init $(1)/etc/init.d/uwsd
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/sbin/uwsd $(1)/usr/sbin/uwsd
endef

ifeq ($(BUILD_VARIANT),mbedtls)
  CMAKE_OPTIONS += -DUSE_MBEDTLS=ON
endif

CMAKE_OPTIONS += -DDEBUG=YES

$(eval $(call BuildPackage,uwsd-openssl))
$(eval $(call BuildPackage,uwsd-mbedtls))
