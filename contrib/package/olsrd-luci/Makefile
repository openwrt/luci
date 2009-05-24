#
# Copyright (C) 2008-2009 Freifunk Leipzig
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#
# $Id$
#

include $(TOPDIR)/rules.mk

PKG_BASENAME:=olsrd
PKG_NAME:=$(PKG_BASENAME)-luci
PKG_BASEVER:=0.5.6-r4
PKG_RELEASE:=1

PKG_HGREV:=edc947c1a5bc
PKG_SOURCE:=$(PKG_HGREV).tar.gz
PKG_SOURCE_URL:=http://gredler.at/hg/olsrd-0.5.6/archive
PKG_MD5SUM:=9b0ee1ef2581386f745f5e12b08e6daa
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_HGREV)
PKG_UNPACK=$(HOST_TAR) -C $(PKG_BUILD_DIR) --strip-components=1 -xzf $(DL_DIR)/$(PKG_SOURCE)
PKG_VERSION:=$(PKG_BASEVER)+$(PKG_HGREV)+luci1

#PKG_SOURCE:=$(PKG_BASENAME)-$(PKG_BASEVER).tar.bz2
#PKG_SOURCE_URL:=http://www.olsr.org/releases/0.5
#PKG_MD5SUM:=16076660413bcf625ba8772fdb3d607f
#PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_BASEVER)
#PKG_UNPACK=$(HOST_TAR) -C $(PKG_BUILD_DIR) --strip-components=1 -xjf $(DL_DIR)/$(PKG_SOURCE)
#PKG_VERSION:=$(PKG_BASEVER)+luci1

include $(INCLUDE_DIR)/package.mk


define Package/olsrd-luci/common_info
	SECTION:=net
	CATEGORY:=Network
	TITLE:=OLSR - Optimized Link State Routing Daemon
	URL:=http://www.olsr.org/
	MAINTAINER:=Jo-Philipp Wich <xm@subsignal.org>
endef

define Package/olsrd-luci
	$(call Package/olsrd-luci/common_info)
	MENU:=1
	DEPENDS:=+libpthread
endef

define Package/olsrd-luci/conffiles
/etc/config/olsrd
endef

define Package/olsrd-luci-mod-arprefresh
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - ARP Refresh Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-dot-draw
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - Dot Draw Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-bmf
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - Basic Multicast Forwarding Plugin
	DEPENDS:=olsrd-luci +kmod-tun
endef

define Package/olsrd-luci-mod-dyn-gw
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - Dynamic Gateway Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-dyn-gw-plain
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - Dynamic Gateway Plugin (Plain Version)
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-httpinfo
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - HTTP/HTML Info Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-nameservice
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - Hostname Propagation Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-secure
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - Security Extensions Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-txtinfo
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - HTTP/Plaintext Info Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-quagga
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - Quagga Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-watchdog
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - Watchdog Plugin
	DEPENDS:=olsrd-luci
endef

define Package/olsrd-luci-mod-mdns
	$(call Package/olsrd-luci/common_info)
	TITLE:=OLSR - mDNS Plugin
	DEPENDS:=olsrd-luci
endef

TARGET_CFLAGS += $(FPIC)

define Build/Compile
	$(MAKE) -C "$(PKG_BUILD_DIR)" olsrd libs \
		$(TARGET_CONFIGURE_OPTS) \
		NODEBUG=1 \
		CFLAGS="$(TARGET_CFLAGS) -DSVEN_OLA_UNBLOAT -DNODEBUG" \
		OS="linux" \
		INSTALL_PREFIX="$(PKG_INSTALL_DIR)" \
		LIBDIR="$(PKG_INSTALL_DIR)/usr/lib" \
		SBINDIR="$(PKG_INSTALL_DIR)/usr/sbin/" \
		ETCDIR="$(PKG_INSTALL_DIR)/etc" \
		MANDIR="$(PKG_INSTALL_DIR)/usr/share/man" \
		STRIP="true" \
		INSTALL_LIB="true" \
		SUBDIRS="arprefresh bmf dot_draw dyn_gw dyn_gw_plain httpinfo nameservice secure txtinfo quagga watchdog mdns"
endef

define Package/olsrd-luci/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/olsrd $(1)/usr/sbin/
	$(INSTALL_BIN) ./files/etc/init.d/olsrd $(1)/etc/init.d/
	$(INSTALL_CONF) ./files/etc/config/olsrd $(1)/etc/config/
endef

define Package/olsrd-luci-mod-arprefresh/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/arprefresh/olsrd_arprefresh.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-dot-draw/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/dot_draw/olsrd_dot_draw.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-bmf/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/bmf/olsrd_bmf.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-dyn-gw/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/dyn_gw/olsrd_dyn_gw.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-dyn-gw-plain/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/dyn_gw_plain/olsrd_dyn_gw_plain.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-httpinfo/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/httpinfo/olsrd_httpinfo.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-nameservice/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/nameservice/olsrd_nameservice.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-secure/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/secure/olsrd_secure.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-txtinfo/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/txtinfo/olsrd_txtinfo.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-quagga/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/quagga/olsrd_quagga.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-watchdog/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/watchdog/olsrd_watchdog.so.* $(1)/usr/lib/
endef

define Package/olsrd-luci-mod-mdns/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lib/mdns/olsrd_mdns.so.* $(1)/usr/lib/
endef


$(eval $(call BuildPackage,olsrd-luci))
$(eval $(call BuildPackage,olsrd-luci-mod-arprefresh))
$(eval $(call BuildPackage,olsrd-luci-mod-dot-draw))
$(eval $(call BuildPackage,olsrd-luci-mod-bmf))
$(eval $(call BuildPackage,olsrd-luci-mod-dyn-gw))
$(eval $(call BuildPackage,olsrd-luci-mod-dyn-gw-plain))
$(eval $(call BuildPackage,olsrd-luci-mod-httpinfo))
$(eval $(call BuildPackage,olsrd-luci-mod-nameservice))
$(eval $(call BuildPackage,olsrd-luci-mod-secure))
$(eval $(call BuildPackage,olsrd-luci-mod-txtinfo))
$(eval $(call BuildPackage,olsrd-luci-mod-quagga))
$(eval $(call BuildPackage,olsrd-luci-mod-watchdog))
$(eval $(call BuildPackage,olsrd-luci-mod-mdns))
