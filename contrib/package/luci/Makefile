include $(TOPDIR)/rules.mk

PKG_BRANCH:=trunk

ifeq ($(DUMP),)
  USELOCAL:=$(shell grep luci ../../../.project 2>/dev/null >/dev/null && echo 1)
endif

PKG_NAME:=luci
PKG_RELEASE:=1

ifeq ($(USELOCAL),1)
  PKG_VERSION:=0.9+svn
else
  PKG_SOURCE_URL:=http://svn.luci.subsignal.org/luci/$(PKG_BRANCH)
  ifeq ($(DUMP),)
    PKG_REV:=$(shell LC_ALL=C svn info $(CURDIR) | sed -ne's/^Revision: //p')
    PKG_VERSION:=0.9+svn$(PKG_REV)
  endif
  PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
  PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
  PKG_SOURCE_PROTO:=svn
  PKG_SOURCE_VERSION:=$(PKG_REV)
endif

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

LUA_TARGET:=source
LUCI_CFLAGS:=
PKG_SELECTED_MODULES:=


include $(INCLUDE_DIR)/package.mk

ifeq ($(USELOCAL),1)
  define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(TAR) c -C ../../../ . \
		--exclude=.pc --exclude=.svn --exclude=.git \
		--exclude='boa-0*' --exclude='*.o' --exclude='*.so' \
		--exclude=dist | \
			tar x -C $(PKG_BUILD_DIR)/
  endef
endif

define Build/Configure
endef

### Templates ###

define Package/luci/libtemplate
  SECTION:=admin
  CATEGORY:=Administration
  TITLE:=LuCI - Lua Configuration Interface
  URL:=http://luci.freifunk-halle.net/
  MAINTAINER:=Steven Barth <steven-at-midlink-dot-org>
  SUBMENU:=LuCI Libraries
  DEPENDS:=+luci-core
endef

define Package/luci/fftemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI Freifunk Support
  DEPENDS:=+luci-mod-freifunk
endef

define Package/luci/httpdtemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCIttpd
  DEPENDS:=+luci-httpd
endef

define Package/luci/i18ntemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI Translations
  DEPENDS:=+luci-web
endef

define Package/luci/thtemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI Themes
  DEPENDS:=+luci-web
endef

define Package/luci/webtemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI Components
endef


define Package/luci/install/template
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/ipkg/* $(1)/CONTROL/ 2>/dev/null || true
endef



### Core package ###

define Package/luci-core
  $(call Package/luci/libtemplate)
  DEPENDS:=+lua
  TITLE:=LuCI core libraries
endef

define Package/luci-core/install
	$(call Package/luci/install/template,$(1),libs/core)
	$(PKG_BUILD_DIR)/build/mkversion.sh $(1)/usr/lib/lua/luci/version.lua \
		"OpenWrt Firmware" \
		"$(OPENWRTVERSION)" \
		"$(PKG_BRANCH)" \
		"$(PKG_VERSION)"
endef

define Package/luci-core/config
       choice
               prompt "Build Target"
               default PACKAGE_luci-core_source

       config PACKAGE_luci-core_compile
               bool "Precompiled"

       config PACKAGE_luci-core_stripped
               bool "Stripped"

       config PACKAGE_luci-core_source
               bool "Full Source"

       config PACKAGE_luci-core_zipped
               bool "Precompiled and compressed"

       endchoice
endef

ifneq ($(CONFIG_PACKAGE_luci-core_compile),)
  LUA_TARGET:=compile
endif

ifneq ($(CONFIG_PACKAGE_luci-core_stripped),)
  LUA_TARGET:=strip
endif

ifneq ($(CONFIG_PACKAGE_luci-core_zipped),)
  LUA_TARGET:=gzip
endif


### Libraries ###
define Package/luci-cbi
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-web +luci-uvl +luci-uci
  TITLE:=Configuration Binding Interface
endef

define Package/luci-cbi/install
	$(call Package/luci/install/template,$(1),libs/cbi)
endef


define Package/luci-uci
  $(call Package/luci/libtemplate)
  DEPENDS+=+libuci-lua
  TITLE:=High-Level UCI API
endef

define Package/luci-uci/install
	$(call Package/luci/install/template,$(1),libs/uci)
endef


define Package/luci-fastindex
  $(call Package/luci/libtemplate)
  TITLE:=Fastindex indexing module
endef

define Package/luci-fastindex/install
	$(call Package/luci/install/template,$(1),libs/fastindex)
endef


define Package/luci-http
  $(call Package/luci/libtemplate)
  TITLE:=HTTP Protocol implementation
endef

define Package/luci-http/install
	$(call Package/luci/install/template,$(1),libs/http)
endef


define Package/luci-httpclient
  $(call Package/luci/libtemplate)
  TITLE:=HTTP(S) client library
  DEPENDS+=+luci-http +luci-nixio
endef

define Package/luci-httpclient/install
	$(call Package/luci/install/template,$(1),libs/httpclient)
endef


define Package/luci-ipkg
  $(call Package/luci/libtemplate)
  TITLE:=LuCI IPKG/OPKG call abstraction library
endef

define Package/luci-ipkg/install
	$(call Package/luci/install/template,$(1),libs/ipkg)
endef


define Package/luci-json
  $(call Package/luci/libtemplate)
  TITLE:=LuCI JSON Library
endef

define Package/luci-json/install
	$(call Package/luci/install/template,$(1),libs/json)
endef


define Package/luci-luanet
  $(call Package/luci/libtemplate)
  TITLE:=luanet
  DEPENDS+=+libiw
endef

define Package/luci-luanet/install
	$(call Package/luci/install/template,$(1),libs/luanet)
endef


define Package/luci-lucid
  $(call Package/luci/libtemplate)
  TITLE:=LuCId Superserver
  DEPENDS+=+luci-nixio +luci-http +luci-px5g
endef

define Package/luci-lucid/install
	$(call Package/luci/install/template,$(1),libs/lucid)
	$(call Package/luci/install/template,$(1),libs/lucid-http)
endef



NIXIO_TLS:=axtls

define Package/luci-nixio
  $(call Package/luci/libtemplate)
  TITLE:=NIXIO Socket Library
  DEPENDS:=
endef

define Package/luci-nixio/install
	$(call Package/luci/install/template,$(1),libs/nixio)
endef

define Package/luci-nixio/config
	choice
		prompt "TLS Provider"
		default PACKAGE_luci-nixio_axtls

		config PACKAGE_luci-nixio_axtls
			bool "Builtin (axTLS)"
			select PACKAGE_dropbear
			select PACKAGE_dropbearconvert

		config PACKAGE_luci-nixio_cyassl
			bool "CyaSSL"
			select PACKAGE_libcyassl-luci

		config PACKAGE_luci-nixio_openssl
			bool "OpenSSL"
			select PACKAGE_libopenssl
	endchoice
endef

ifneq ($(CONFIG_PACKAGE_luci-nixio_openssl),)
  NIXIO_TLS:=openssl
endif

ifneq ($(CONFIG_PACKAGE_luci-nixio_cyassl),)
  NIXIO_TLS:=cyassl
  LUCI_CFLAGS+=-I$(STAGING_DIR)/usr/include/cyassl
endif


define Package/luci-px5g
  $(call Package/luci/libtemplate)
  TITLE:=PX5G RSA Keymaster
  DEPENDS:=+luci-nixio
endef

define Package/luci-px5g/install
	$(call Package/luci/install/template,$(1),libs/px5g)
endef


define Package/luci-sys
  $(call Package/luci/libtemplate)
  TITLE:=LuCI Linux/POSIX system library
endef

define Package/luci-sys/install
	$(call Package/luci/install/template,$(1),libs/sys)
endef


define Package/luci-web
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-http +luci-sys +luci-uci +luci-lucid +luci-sgi-cgi
  TITLE:=MVC Webframework
  $(call Config,luci.main.lang,string,en,Default Language)
endef

define Package/luci-web/conffiles
/etc/config/luci
endef

define Package/luci-web/install
	$(call Package/luci/install/template,$(1),libs/web)
endef


define Package/luci-uvl
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-sys +luci-uci +luci-core
  TITLE:=UVL - UCI Validation Layer
endef

define Package/luci-uvl/install
	$(call Package/luci/install/template,$(1),libs/uvl)
endef



### HTTPD ###

define Package/luci-httpd
  $(call Package/luci/httpdtemplate)
  DEPENDS:=+luci-http +libuci
  TITLE:=Server Core
endef

define Package/luci-httpd/install
	$(call Package/luci/install/template,$(1),libs/lucittpd)
endef



### Community Packages ###

define Package/luci-freifunk-community
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-lucid +luci-sgi-cgi +luci-app-splash \
   +luci-app-ffwizard-leipzig \
   +luci-i18n-german \
   +PACKAGE_luci-freifunk-community:olsrd-luci +PACKAGE_luci-freifunk-community:olsrd-luci-mod-dyn-gw-plain \
   +PACKAGE_luci-freifunk-community:olsrd-luci-mod-txtinfo +PACKAGE_luci-freifunk-community:olsrd-luci-mod-nameservice \
   +PACKAGE_luci-freifunk-community:olsrd-luci-mod-watchdog +PACKAGE_luci-freifunk-community:kmod-tun \
   +PACKAGE_luci-freifunk-community:ip +PACKAGE_luci-freifunk-community:freifunk-watchdog +luci-app-olsr
  TITLE:=Freifunk Community Meta-Package
endef

define Package/luci-freifunk-community/install
	$(call Package/luci/install/template,$(1),applications/freifunk-community)
endef

### Modules ###

define Package/luci-admin-core
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-web +luci-cbi +luci-i18n-english
  TITLE:=Web UI Core Module
endef

define Package/luci-admin-core/conffiles
/etc/config/luci_hosts
/etc/config/luci_ethers
endef

define Package/luci-admin-core/install
	$(call Package/luci/install/template,$(1),modules/admin-core)
	touch $(1)/etc/init.d/luci_fixtime || true
endef


define Package/luci-admin-mini
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-core
  TITLE:=LuCI Essentials - stripped down and user-friendly
endef

define Package/luci-admin-mini/install
	$(call Package/luci/install/template,$(1),modules/admin-mini)
endef


define Package/luci-admin-full
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-core +luci-ipkg
  TITLE:=LuCI Administration - full-featured for full control
endef

define Package/luci-admin-full/install
	$(call Package/luci/install/template,$(1),modules/admin-full)
endef


define Package/luci-admin-rpc
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-json
  TITLE:=LuCI RPC - JSON-RPC API
endef

define Package/luci-admin-rpc/install
	$(call Package/luci/install/template,$(1),modules/rpc)
endef


define Package/luci-mod-freifunk
  $(call Package/luci/fftemplate)
  DEPENDS:=+luci-admin-full +luci-json
  TITLE:=LuCI Freifunk module
endef

define Package/luci-mod-freifunk/conffiles
/etc/config/freifunk
endef

define Package/luci-mod-freifunk/install
	$(call Package/luci/install/template,$(1),modules/freifunk)
endef



### Applications ###

define Package/luci-app-ffwizard-leipzig
  $(call Package/luci/fftemplate)
  TITLE:=Freifunk Leipzig configuration wizard
endef

define Package/luci-app-ffwizard-leipzig/install
	$(call Package/luci/install/template,$(1),applications/luci-ffwizard-leipzig)
endef


define Package/luci-app-siitwizard
  $(call Package/luci/fftemplate)
  TITLE:=SIIT IPv4-over-IPv6 configuration wizard
  DEPENDS:=+luci-admin-core +PACKAGE_luci-app-siitwizard:kmod-siit
endef

define Package/luci-app-siitwizard/install
	$(call Package/luci/install/template,$(1),applications/luci-siitwizard)
endef


define Package/luci-app-firewall
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-core +PACKAGE_luci-app-firewall:firewall
  TITLE:=Firewall and Portforwarding application
endef

define Package/luci-app-firewall/install
	$(call Package/luci/install/template,$(1),applications/luci-fw)
endef


define Package/luci-app-olsr
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-olsr:olsrd-luci \
   +PACKAGE_luci-app-olsr:olsrd-luci-mod-txtinfo
  TITLE:=OLSR configuration and status module
endef

define Package/luci-app-olsr/install
	$(call Package/luci/install/template,$(1),applications/luci-olsr)
endef


define Package/luci-app-qos
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-core +PACKAGE_luci-app-qos:qos-scripts
  TITLE:=Quality of Service configuration module
endef

define Package/luci-app-qos/install
	$(call Package/luci/install/template,$(1),applications/luci-qos)
endef


define Package/luci-app-splash
  $(call Package/luci/fftemplate)
  DEPENDS+=+PACKAGE_luci-app-splash:luci-nixio \
   +PACKAGE_luci-app-splash:tc +PACKAGE_luci-app-splash:kmod-sched \
   +PACKAGE_luci-app-splash:iptables-mod-nat-extra \
   +PACKAGE_luci-app-splash:iptables-mod-ipopt
  TITLE:=Freifunk DHCP-Splash application
endef

define Package/luci-app-splash/conffiles
/etc/config/luci_splash
endef

define Package/luci-app-splash/install
	$(call Package/luci/install/template,$(1),applications/luci-splash)
endef


define Package/luci-app-statistics
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-statistics:collectd \
   +PACKAGE_luci-app-statistics:rrdtool1 \
   +PACKAGE_luci-app-statistics:collectd-mod-rrdtool1 \
   +PACKAGE_luci-app-statistics:collectd-mod-wireless \
   +PACKAGE_luci-app-statistics:collectd-mod-interface \
   +PACKAGE_luci-app-statistics:collectd-mod-load
  TITLE:=LuCI Statistics Application
endef

define Package/luci-app-statistics/conffiles
/etc/config/luci_statistics
endef

define Package/luci-app-statistics/install
	$(call Package/luci/install/template,$(1),applications/luci-statistics)
endef


define Package/luci-app-upnp
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-core +PACKAGE_luci-app-upnp:miniupnpd
  TITLE:=Universal Plug & Play configuration module
endef

define Package/luci-app-upnp/install
	$(call Package/luci/install/template,$(1),applications/luci-upnp)
endef


define Package/luci-app-ntpc
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-core +PACKAGE_luci-app-ntpc:ntpclient
  TITLE:=NTP time synchronisation client configuration module
endef

define Package/luci-app-ntpc/install
	$(call Package/luci/install/template,$(1),applications/luci-ntpc)
endef


define Package/luci-app-ddns
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-core +PACKAGE_luci-app-ddns:ddns-scripts
  TITLE:=Dynamic DNS configuration module
endef

define Package/luci-app-ddns/install
	$(call Package/luci/install/template,$(1),applications/luci-ddns)
endef


define Package/luci-app-samba
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-samba:samba3
  TITLE:=Network Shares - Samba SMB/CIFS module
endef

define Package/luci-app-samba/install
	$(call Package/luci/install/template,$(1),applications/luci-samba)
endef


define Package/luci-app-uvc_streamer
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-uvc_streamer:uvc-streamer
  TITLE:=Webcam Streaming - UVC-Streamer module
endef

define Package/luci-app-uvc_streamer/install
        $(call Package/luci/install/template,$(1),applications/luci-uvc_streamer)
endef


define Package/luci-app-mmc_over_gpio
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-mmc_over_gpio:kmod-mmc-over-gpio
  TITLE:=mmc_over_gpio
endef

define Package/luci-app-mmc_over_gpio/install
        $(call Package/luci/install/template,$(1),applications/luci-mmc_over_gpio)
endef


define Package/luci-app-p910nd
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-p910nd:p910nd
  TITLE:=p910nd - Printer server module
endef

define Package/luci-app-p910nd/install
        $(call Package/luci/install/template,$(1),applications/luci-p910nd)
endef


define Package/luci-app-ushare
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-ushare:ushare
  TITLE:=ushare - UPnP A/V & DLNA Media Server
endef

define Package/luci-app-ushare/install
        $(call Package/luci/install/template,$(1),applications/luci-ushare)
endef

define Package/luci-app-hd_idle
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-hd_idle:hd-idle
  TITLE:=hd-idle
endef

define Package/luci-app-hd_idle/install
        $(call Package/luci/install/template,$(1),applications/luci-hd_idle)
endef

define Package/luci-app-tinyproxy
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full +PACKAGE_luci-app-tinyproxy:tinyproxy
  TITLE:=Tinyproxy - HTTP(S)-Proxy
endef

define Package/luci-app-tinyproxy/install
        $(call Package/luci/install/template,$(1),applications/luci-tinyproxy)
endef

define Package/luci-app-initmgr
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-full
  TITLE:=LuCI Initscript Management
endef

define Package/luci-app-initmgr/install
        $(call Package/luci/install/template,$(1),applications/luci-initmgr)
endef

define Package/luci-app-livestats
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-admin-core +luci-admin-rpc
  TITLE:=LuCI Realtime Statistics
endef

define Package/luci-app-livestats/install
        $(call Package/luci/install/template,$(1),applications/luci-livestats)
endef

define Package/luci-app-asterisk
  $(call Package/luci/webtemplate)
  TITLE:=LuCI Support for Asterisk PBX
  DEPENDS+=@BROKEN +luci-admin-core +PACKAGE_luci-app-asterisk:asterisk14-xip-core
endef

define Package/luci-app-asterisk/install
        $(call Package/luci/install/template,$(1),applications/luci-asterisk)
endef

define Package/luci-app-polipo
  $(call Package/luci/webtemplate)
  TITLE:=LuCI Support for the Polipo Proxy
  DEPENDS+=+luci-admin-core +PACKAGE_luci-app-polipo:polipo
endef

define Package/luci-app-polipo/install
        $(call Package/luci/install/template,$(1),applications/luci-polipo)
endef

define Package/luci-app-openvpn
  $(call Package/luci/webtemplate)
  TITLE:=LuCI Support for OpenVPN
  DEPENDS+=+luci-admin-core +PACKAGE_luci-app-openvpn:openvpn
endef

define Package/luci-app-openvpn/install
        $(call Package/luci/install/template,$(1),applications/luci-openvpn)
endef

define Package/luci-app-p2pblock
  $(call Package/luci/webtemplate)
  TITLE:=LuCI Support for the Freifunk P2P-Block addon
  DEPENDS+=+luci-admin-core +luci-app-firewall \
    +PACKAGE_luci-app-p2pblock:freifunk-p2pblock
endef

define Package/luci-app-p2pblock/install
        $(call Package/luci/install/template,$(1),applications/luci-p2pblock)
endef


### Server Gateway Interfaces ###

define Package/luci-sgi-cgi
  $(call Package/luci/libtemplate)
  TITLE:=SGI for CGI
endef

define Package/luci-sgi-cgi/install
	$(call Package/luci/install/template,$(1),libs/sgi-cgi)
endef

### Themes ###
define Package/luci-theme-base
  $(call Package/luci/thtemplate)
  DEPENDS:=+luci-web
  TITLE:=Common base for all themes
endef

define Package/luci-theme-base/install
	$(call Package/luci/install/template,$(1),themes/base)
endef

define Package/luci-theme-fledermaus
  $(call Package/luci/fftemplate)
  DEPENDS:=+luci-web
  TITLE:=Fledermaus Theme
endef

define Package/luci-theme-fledermaus/install
	$(call Package/luci/install/template,$(1),themes/fledermaus)
endef

define Package/luci-theme-freifunk
  $(call Package/luci/fftemplate)
  DEPENDS:=+luci-web
  MAINTAINER:=Stefan Pirwitz <stefan-at-freifunk-bno-dot-de>
  TITLE:=alternative Freifunk Theme
endef

define Package/luci-theme-freifunk/install
        $(call Package/luci/install/template,$(1),themes/freifunk)
endef

define Package/luci-theme-freifunk-bno
  $(call Package/luci/fftemplate)
  DEPENDS:=+luci-web
  MAINTAINER:=Stefan Pirwitz <stefan-at-freifunk-bno-dot-de>
  TITLE:=Freifunk Berlin Nordost Theme
endef

define Package/luci-theme-freifunk-bno/install
	$(call Package/luci/install/template,$(1),themes/freifunk-bno)
endef

define Package/luci-theme-freifunk-hannover
  $(call Package/luci/fftemplate)
  DEPENDS:=+luci-web
  MAINTAINER:=Mikolas Bingemer <mickey-at-freifunk-hannover-dot-de>
  TITLE:=Freifunk Hannover Theme
endef

define Package/luci-theme-freifunk-hannover/install
	$(call Package/luci/install/template,$(1),themes/freifunk-hannover)
endef

define Package/luci-theme-openwrt
  $(call Package/luci/thtemplate)
  TITLE:=OpenWrt.org (default)
  DEPENDS:=+luci-theme-base
endef

define Package/luci-theme-openwrt/install
	$(call Package/luci/install/template,$(1),themes/openwrt.org)
endef

define Package/luci-theme-openwrtlight
  $(call Package/luci/thtemplate)
  TITLE:=OpenWrt.org - light variant without images
  DEPENDS:=+luci-theme-base
endef

define Package/luci-theme-openwrtlight/install
	$(call Package/luci/install/template,$(1),themes/openwrt-light)
endef


### Translations ###
define Package/luci-i18n-german
  $(call Package/luci/i18ntemplate)
  TITLE:=German
endef

define Package/luci-i18n-german/install
	$(call Package/luci/install/template,$(1),i18n/german)
endef


define Package/luci-i18n-english
  $(call Package/luci/i18ntemplate)
  TITLE:=English
endef

define Package/luci-i18n-english/install
	$(call Package/luci/install/template,$(1),i18n/english)
endef


define Package/luci-i18n-french
  $(call Package/luci/i18ntemplate)
  TITLE:=French (by Florian Fainelli)
endef

define Package/luci-i18n-french/install
	$(call Package/luci/install/template,$(1),i18n/french)
endef


define Package/luci-i18n-italian
  $(call Package/luci/i18ntemplate)
  TITLE:=Italian (by Matteo Croce)
endef

define Package/luci-i18n-italian/install
	$(call Package/luci/install/template,$(1),i18n/italian)
endef


define Package/luci-i18n-russian
  $(call Package/luci/i18ntemplate)
  TITLE:=Russian (by Skryabin Dmitry)
endef

define Package/luci-i18n-russian/install
	$(call Package/luci/install/template,$(1),i18n/russian)
endef


define Package/luci-i18n-portuguese_brazilian
  $(call Package/luci/i18ntemplate)
  TITLE:=Portuguese (Brazilian) (by Carlos Cesario)
endef

define Package/luci-i18n-portuguese_brazilian/install
	$(call Package/luci/install/template,$(1),i18n/portuguese_brazilian)
endef


define Package/luci-i18n-japanese
  $(call Package/luci/i18ntemplate)
  TITLE:=Japanese (by Tsukasa Hamano)
endef

define Package/luci-i18n-japanese/install
	$(call Package/luci/install/template,$(1),i18n/japanese)
endef


define Package/luci-i18n-greek
  $(call Package/luci/i18ntemplate)
  TITLE:=Greek (by Vasilis Tsiligiannis)
endef

define Package/luci-i18n-greek/install
	$(call Package/luci/install/template,$(1),i18n/greek)
endef


define Package/luci-i18n-catalan
  $(call Package/luci/i18ntemplate)
  TITLE:=Catalan (by Eduard Duran)
endef

define Package/luci-i18n-catalan/install
	$(call Package/luci/install/template,$(1),i18n/catalan)
endef


define Package/luci-i18n-portuguese
  $(call Package/luci/i18ntemplate)
  TITLE:=Portuguese (by Jose Monteiro)
endef

define Package/luci-i18n-portuguese/install
	$(call Package/luci/install/template,$(1),i18n/portuguese)
endef


### Compile ###
ifneq ($(CONFIG_PACKAGE_luci-core),)
	PKG_SELECTED_MODULES+=libs/core
endif
ifneq ($(CONFIG_PACKAGE_luci-cbi),)
	PKG_SELECTED_MODULES+=libs/cbi
endif
ifneq ($(CONFIG_PACKAGE_luci-fastindex),)
	PKG_SELECTED_MODULES+=libs/fastindex
endif
ifneq ($(CONFIG_PACKAGE_luci-http),)
	PKG_SELECTED_MODULES+=libs/http
endif
ifneq ($(CONFIG_PACKAGE_luci-httpclient),)
	PKG_SELECTED_MODULES+=libs/httpclient
endif
ifneq ($(CONFIG_PACKAGE_luci-ipkg),)
	PKG_SELECTED_MODULES+=libs/ipkg
endif
ifneq ($(CONFIG_PACKAGE_luci-json),)
	PKG_SELECTED_MODULES+=libs/json
endif
ifneq ($(CONFIG_PACKAGE_luci-luanet),)
	PKG_SELECTED_MODULES+=libs/luanet
endif
ifneq ($(CONFIG_PACKAGE_luci-lucid),)
	PKG_SELECTED_MODULES+=libs/lucid libs/lucid-http
endif
ifneq ($(CONFIG_PACKAGE_luci-nixio),)
	PKG_SELECTED_MODULES+=libs/nixio
endif
ifneq ($(CONFIG_PACKAGE_luci-px5g),)
	PKG_SELECTED_MODULES+=libs/px5g
endif
ifneq ($(CONFIG_PACKAGE_luci-uci),)
	PKG_SELECTED_MODULES+=libs/uci
endif
ifneq ($(CONFIG_PACKAGE_luci-sys),)
	PKG_SELECTED_MODULES+=libs/sys
endif
ifneq ($(CONFIG_PACKAGE_luci-web),)
	PKG_SELECTED_MODULES+=libs/web
endif
ifneq ($(CONFIG_PACKAGE_luci-uvl),)
	PKG_SELECTED_MODULES+=libs/uvl
endif

ifneq ($(CONFIG_PACKAGE_luci-httpd),)
	PKG_SELECTED_MODULES+=libs/lucittpd
endif

ifneq ($(CONFIG_PACKAGE_luci-admin-core),)
	PKG_SELECTED_MODULES+=modules/admin-core
endif
ifneq ($(CONFIG_PACKAGE_luci-admin-mini),)
	PKG_SELECTED_MODULES+=modules/admin-mini
endif
ifneq ($(CONFIG_PACKAGE_luci-admin-full),)
	PKG_SELECTED_MODULES+=modules/admin-full
endif
ifneq ($(CONFIG_PACKAGE_luci-admin-rpc),)
	PKG_SELECTED_MODULES+=modules/rpc
endif
ifneq ($(CONFIG_PACKAGE_luci-mod-freifunk),)
	PKG_SELECTED_MODULES+=modules/freifunk
endif

ifneq ($(CONFIG_PACKAGE_luci-freifunk-community),)
	PKG_SELECTED_MODULES+=applications/freifunk-community
endif

ifneq ($(CONFIG_PACKAGE_luci-app-ffwizard-leipzig),)
	PKG_SELECTED_MODULES+=applications/luci-ffwizard-leipzig
endif
ifneq ($(CONFIG_PACKAGE_luci-app-siitwizard),)
	PKG_SELECTED_MODULES+=applications/luci-siitwizard
endif
ifneq ($(CONFIG_PACKAGE_luci-app-firewall),)
	PKG_SELECTED_MODULES+=applications/luci-fw
endif
ifneq ($(CONFIG_PACKAGE_luci-app-olsr),)
	PKG_SELECTED_MODULES+=applications/luci-olsr
endif
ifneq ($(CONFIG_PACKAGE_luci-app-qos),)
	PKG_SELECTED_MODULES+=applications/luci-qos
endif
ifneq ($(CONFIG_PACKAGE_luci-app-splash),)
	PKG_SELECTED_MODULES+=applications/luci-splash
endif
ifneq ($(CONFIG_PACKAGE_luci-app-statistics),)
	PKG_SELECTED_MODULES+=applications/luci-statistics
endif
ifneq ($(CONFIG_PACKAGE_luci-app-upnp),)
	PKG_SELECTED_MODULES+=applications/luci-upnp
endif
ifneq ($(CONFIG_PACKAGE_luci-app-ntpc),)
	PKG_SELECTED_MODULES+=applications/luci-ntpc
endif
ifneq ($(CONFIG_PACKAGE_luci-app-ddns),)
	PKG_SELECTED_MODULES+=applications/luci-ddns
endif
ifneq ($(CONFIG_PACKAGE_luci-app-samba),)
	PKG_SELECTED_MODULES+=applications/luci-samba
endif
ifneq ($(CONFIG_PACKAGE_luci-app-uvc_streamer),)
	PKG_SELECTED_MODULES+=applications/luci-uvc_streamer
endif
ifneq ($(CONFIG_PACKAGE_luci-app-mmc_over_gpio),)
        PKG_SELECTED_MODULES+=applications/luci-mmc_over_gpio
endif
ifneq ($(CONFIG_PACKAGE_luci-app-p910nd),)
        PKG_SELECTED_MODULES+=applications/luci-p910nd
endif
ifneq ($(CONFIG_PACKAGE_luci-app-ushare),)
        PKG_SELECTED_MODULES+=applications/luci-ushare
endif
ifneq ($(CONFIG_PACKAGE_luci-app-hd_idle),)
       PKG_SELECTED_MODULES+=applications/luci-hd_idle
endif
ifneq ($(CONFIG_PACKAGE_luci-app-tinyproxy),)
       PKG_SELECTED_MODULES+=applications/luci-tinyproxy
endif
ifneq ($(CONFIG_PACKAGE_luci-app-initmgr),)
       PKG_SELECTED_MODULES+=applications/luci-initmgr
endif
ifneq ($(CONFIG_PACKAGE_luci-app-livestats),)
       PKG_SELECTED_MODULES+=applications/luci-livestats
endif
ifneq ($(CONFIG_PACKAGE_luci-app-asterisk),)
       PKG_SELECTED_MODULES+=applications/luci-asterisk
endif
ifneq ($(CONFIG_PACKAGE_luci-app-polipo),)
       PKG_SELECTED_MODULES+=applications/luci-polipo
endif
ifneq ($(CONFIG_PACKAGE_luci-app-openvpn),)
       PKG_SELECTED_MODULES+=applications/luci-openvpn
endif
ifneq ($(CONFIG_PACKAGE_luci-app-p2pblock),)
       PKG_SELECTED_MODULES+=applications/luci-p2pblock
endif


ifneq ($(CONFIG_PACKAGE_luci-sgi-cgi),)
	PKG_SELECTED_MODULES+=libs/sgi-cgi
endif
ifneq ($(CONFIG_PACKAGE_luci-sgi-luci),)
	PKG_SELECTED_MODULES+=libs/sgi-luci
endif
ifneq ($(CONFIG_PACKAGE_luci-sgi-webuci),)
	PKG_SELECTED_MODULES+=libs/sgi-webuci
endif

ifneq ($(CONFIG_PACKAGE_luci-theme-base),)
	PKG_SELECTED_MODULES+=themes/base
endif
ifneq ($(CONFIG_PACKAGE_luci-theme-fledermaus),)
	PKG_SELECTED_MODULES+=themes/fledermaus
endif
ifneq ($(CONFIG_PACKAGE_luci-theme-freifunk-bno),)
	PKG_SELECTED_MODULES+=themes/freifunk-bno
endif
ifneq ($(CONFIG_PACKAGE_luci-theme-freifunk-hannover),)
	PKG_SELECTED_MODULES+=themes/freifunk-hannover
endif
ifneq ($(CONFIG_PACKAGE_luci-theme-freifunk),)
	PKG_SELECTED_MODULES+=themes/freifunk
endif
ifneq ($(CONFIG_PACKAGE_luci-theme-openwrt),)
	PKG_SELECTED_MODULES+=themes/openwrt.org
endif
ifneq ($(CONFIG_PACKAGE_luci-theme-openwrtlight),)
	PKG_SELECTED_MODULES+=themes/openwrt-light
endif

ifneq ($(CONFIG_PACKAGE_luci-i18n-german),)
	PKG_SELECTED_MODULES+=i18n/german
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-english),)
	PKG_SELECTED_MODULES+=i18n/english
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-french),)
	PKG_SELECTED_MODULES+=i18n/french
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-italian),)
	PKG_SELECTED_MODULES+=i18n/italian
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-russian),)
	PKG_SELECTED_MODULES+=i18n/russian
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-portuguese_brazilian),)
	PKG_SELECTED_MODULES+=i18n/portuguese_brazilian
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-japanese),)
	PKG_SELECTED_MODULES+=i18n/japanese
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-greek),)
	PKG_SELECTED_MODULES+=i18n/greek
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-catalan),)
	PKG_SELECTED_MODULES+=i18n/catalan
endif
ifneq ($(CONFIG_PACKAGE_luci-i18n-portuguese),)
	PKG_SELECTED_MODULES+=i18n/portuguese
endif


MAKE_FLAGS += \
	MODULES="$(PKG_SELECTED_MODULES)" \
	LUA_TARGET="$(LUA_TARGET)" \
	LUA_SHLIBS="-llua -lm -ldl -lcrypt" \
	CFLAGS="$(TARGET_CFLAGS) $(LUCI_CFLAGS) -I$(STAGING_DIR)/usr/include" \
	LDFLAGS="$(TARGET_LDFLAGS) -L$(STAGING_DIR)/usr/lib" \
	NIXIO_TLS="$(NIXIO_TLS)" OS="Linux"


$(eval $(call BuildPackage,luci-core))
$(eval $(call BuildPackage,luci-cbi))
$(eval $(call BuildPackage,luci-fastindex))
$(eval $(call BuildPackage,luci-http))
$(eval $(call BuildPackage,luci-httpclient))
$(eval $(call BuildPackage,luci-ipkg))
$(eval $(call BuildPackage,luci-json))
$(eval $(call BuildPackage,luci-luanet))
$(eval $(call BuildPackage,luci-lucid))
$(eval $(call BuildPackage,luci-nixio))
$(eval $(call BuildPackage,luci-px5g))
$(eval $(call BuildPackage,luci-uci))
$(eval $(call BuildPackage,luci-sys))
$(eval $(call BuildPackage,luci-web))
$(eval $(call BuildPackage,luci-uvl))

$(eval $(call BuildPackage,luci-httpd))

$(eval $(call BuildPackage,luci-admin-core))
$(eval $(call BuildPackage,luci-admin-mini))
$(eval $(call BuildPackage,luci-admin-full))
$(eval $(call BuildPackage,luci-admin-rpc))
$(eval $(call BuildPackage,luci-mod-freifunk))

$(eval $(call BuildPackage,luci-freifunk-community))

$(eval $(call BuildPackage,luci-app-ffwizard-leipzig))
$(eval $(call BuildPackage,luci-app-siitwizard))
$(eval $(call BuildPackage,luci-app-firewall))
$(eval $(call BuildPackage,luci-app-olsr))
$(eval $(call BuildPackage,luci-app-qos))
$(eval $(call BuildPackage,luci-app-splash))
$(eval $(call BuildPackage,luci-app-statistics))
$(eval $(call BuildPackage,luci-app-upnp))
$(eval $(call BuildPackage,luci-app-ntpc))
$(eval $(call BuildPackage,luci-app-ddns))
$(eval $(call BuildPackage,luci-app-samba))
$(eval $(call BuildPackage,luci-app-uvc_streamer))
$(eval $(call BuildPackage,luci-app-mmc_over_gpio))
$(eval $(call BuildPackage,luci-app-p910nd))
$(eval $(call BuildPackage,luci-app-ushare))
$(eval $(call BuildPackage,luci-app-hd_idle))
$(eval $(call BuildPackage,luci-app-tinyproxy))
$(eval $(call BuildPackage,luci-app-initmgr))
$(eval $(call BuildPackage,luci-app-livestats))
$(eval $(call BuildPackage,luci-app-asterisk))
$(eval $(call BuildPackage,luci-app-polipo))
$(eval $(call BuildPackage,luci-app-openvpn))
$(eval $(call BuildPackage,luci-app-p2pblock))

$(eval $(call BuildPackage,luci-sgi-cgi))

$(eval $(call BuildPackage,luci-theme-base))
$(eval $(call BuildPackage,luci-theme-fledermaus))
$(eval $(call BuildPackage,luci-theme-freifunk))
$(eval $(call BuildPackage,luci-theme-freifunk-bno))
$(eval $(call BuildPackage,luci-theme-freifunk-hannover))
$(eval $(call BuildPackage,luci-theme-openwrt))
$(eval $(call BuildPackage,luci-theme-openwrtlight))

$(eval $(call BuildPackage,luci-i18n-german))
$(eval $(call BuildPackage,luci-i18n-english))
$(eval $(call BuildPackage,luci-i18n-french))
$(eval $(call BuildPackage,luci-i18n-italian))
$(eval $(call BuildPackage,luci-i18n-russian))
$(eval $(call BuildPackage,luci-i18n-portuguese_brazilian))
$(eval $(call BuildPackage,luci-i18n-japanese))
$(eval $(call BuildPackage,luci-i18n-greek))
$(eval $(call BuildPackage,luci-i18n-catalan))
$(eval $(call BuildPackage,luci-i18n-portuguese))
