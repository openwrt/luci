include $(TOPDIR)/rules.mk

PKG_BRANCH:=trunk

ifeq ($(DUMP),)
  USELOCAL:=$(shell grep luci ../../../.project 2>/dev/null >/dev/null && echo 1)
endif

PKG_NAME:=luci
PKG_RELEASE:=1

ifeq ($(USELOCAL),1)
  PKG_VERSION:=0.10+svn
else
  PKG_SOURCE_URL:=http://svn.luci.subsignal.org/luci/$(PKG_BRANCH)
  ifeq ($(DUMP),)
    PKG_REV:=$(shell LC_ALL=C svn info $(CURDIR) | sed -ne's/^Revision: //p')
    PKG_VERSION:=0.10+svn$(PKG_REV)
  endif
  PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
  PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
  PKG_SOURCE_PROTO:=svn
  PKG_SOURCE_VERSION:=$(PKG_REV)
endif

PKG_BUILD_DEPENDS:=$(if $(STAGING_DIR_ROOT),lua/host)
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

LUA_TARGET:=source
LUCI_CFLAGS:=
PKG_SELECTED_MODULES:=

ifeq ($(BOARD),brcm-2.4)
  MAKE_FLAGS += CRAP="1"
endif

BUILD_PACKAGES:=


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

MAKE_FLAGS += \
	MODULES="$(PKG_SELECTED_MODULES)" \
	LUA_TARGET="$(LUA_TARGET)" \
	LUA_SHLIBS="-llua -lm -ldl -lcrypt" \
	CFLAGS="$(TARGET_CFLAGS) $(LUCI_CFLAGS) -I$(STAGING_DIR)/usr/include" \
	LDFLAGS="$(TARGET_LDFLAGS) -L$(STAGING_DIR)/usr/lib" \
	NIXIO_TLS="$(NIXIO_TLS)" OS="Linux"


### Templates ###

define Package/luci/libtemplate
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=LuCI - Lua Configuration Interface
  URL:=http://luci.freifunk-halle.net/
  MAINTAINER:=Steven Barth <steven-at-midlink-dot-org>
  SUBMENU:=Internal Libraries
  DEPENDS:=+luci-core
endef

define Package/luci/webservertemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=Webserver
endef

define Package/luci/fftemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=Freifunk
  DEPENDS:=+luci-mod-freifunk
endef

define Package/luci/i18ntemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=Translations
  DEPENDS:=+luci-web
endef

define Package/luci/thtemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=Themes
  DEPENDS:=+luci-web
endef

define Package/luci/maintemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=
endef

define Package/luci/webtemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=Components
endef

define Package/luci/collectiontemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=Collections
endef


define Package/luci/install/template
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/ipkg/* $(1)/CONTROL/ 2>/dev/null || true
endef



### Core package ###
define Package/luci-core
  $(call Package/luci/libtemplate)
  DEPENDS:=+lua +luci-nixio
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

ifneq ($(CONFIG_PACKAGE_luci-core),)
  PKG_SELECTED_MODULES+=libs/core
endif

BUILD_PACKAGES += luci-core


### Libraries ###
define library
  define Package/luci-$(1)
    $(call Package/luci/libtemplate)
    TITLE:=$(if $(2),$(2),LuCI $(1) library)
    $(if $(3),DEPENDS:=$(3))
  endef

  define Package/luci-$(1)/install
	$(call Package/luci/install/template,$$(1),libs/$(1))
	$(call Package/luci-$(1)/extra-install)
  endef

  ifneq ($(CONFIG_PACKAGE_luci-$(1)),)
    PKG_SELECTED_MODULES+=libs/$(1)
  endif

  BUILD_PACKAGES += luci-$(1)
endef

define Package/luci-lucid/extra-install
	$(call Package/luci/install/template,$(1),libs/lucid-http)
endef

define Package/luci-web/conffiles
/etc/config/luci
endef

define Package/luci-nixio/config
	choice
		prompt "TLS Provider"
		default PACKAGE_luci-nixio_notls

		config PACKAGE_luci-nixio_notls
			bool "Disabled"

		config PACKAGE_luci-nixio_axtls
			bool "Builtin (axTLS)"

		config PACKAGE_luci-nixio_cyassl
			bool "CyaSSL"
			select PACKAGE_libcyassl

		config PACKAGE_luci-nixio_openssl
			bool "OpenSSL"
			select PACKAGE_libopenssl
	endchoice
endef


NIXIO_TLS:=

ifneq ($(CONFIG_PACKAGE_luci-nixio_axtls),)
  NIXIO_TLS:=axtls
endif

ifneq ($(CONFIG_PACKAGE_luci-nixio_openssl),)
  NIXIO_TLS:=openssl
endif

ifneq ($(CONFIG_PACKAGE_luci-nixio_cyassl),)
  NIXIO_TLS:=cyassl
  LUCI_CFLAGS+=-I$(STAGING_DIR)/usr/include/cyassl
endif


$(eval $(call library,fastindex,Fastindex indexing module))
$(eval $(call library,httpclient,HTTP(S) client library,+luci-web +luci-nixio))
$(eval $(call library,ipkg,LuCI IPKG/OPKG call abstraction library))
$(eval $(call library,json,LuCI JSON library))
$(eval $(call library,lmo,LuCI LMO I18N library))
$(eval $(call library,luanet,LuCI luanet library,+libiw))
$(eval $(call library,lucid,LuCId Full-Stack Webserver,+luci-nixio +luci-web +luci-px5g))
$(eval $(call library,nixio,NIXIO POSIX library,+PACKAGE_luci-nixio_openssl:libopenssl +PACKAGE_luci-nixio_cyassl:libcyassl))
$(eval $(call library,px5g,RSA/X.509 Key Generator (required for LuCId SSL support),+luci-nixio))
$(eval $(call library,sys,LuCI Linux/POSIX system library,+libiwinfo))
$(eval $(call library,web,MVC Webframework,+luci-sys +luci-nixio +luci-core +luci-sgi-cgi +luci-lmo))
$(eval $(call library,uvl,UVL - UCI Validation Layer,+luci-sys +luci-core))


### Community Packages ###
define Package/luci-freifunk-community
  $(call Package/luci/fftemplate)
  TITLE:=Freifunk Community Meta-Package
  DEPENDS+= \
   +luci-web +luci-app-splash \
   +luci-app-ffwizard-leipzig \
   +luci-i18n-german \
   +PACKAGE_luci-freifunk-community:olsrd-luci +PACKAGE_luci-freifunk-community:olsrd-luci-mod-dyn-gw-plain \
   +PACKAGE_luci-freifunk-community:olsrd-luci-mod-txtinfo +PACKAGE_luci-freifunk-community:olsrd-luci-mod-nameservice \
   +PACKAGE_luci-freifunk-community:olsrd-luci-mod-watchdog +PACKAGE_luci-freifunk-community:kmod-tun \
   +PACKAGE_luci-freifunk-community:ip +PACKAGE_luci-freifunk-community:freifunk-watchdog +luci-app-olsr
endef

define Package/luci-freifunk-community/install
	$(call Package/luci/install/template,$(1),applications/freifunk-community)
endef

ifneq ($(CONFIG_PACKAGE_luci-freifunk-community),)
	PKG_SELECTED_MODULES+=applications/freifunk-community
endif

BUILD_PACKAGES += luci-freifunk-community


### Modules ###
define module
  define Package/luci-$(1)
    $(call Package/luci/webtemplate)
    TITLE:=$(if $(2),$(2),LuCI luci-$(1) module)
    $(if $(3),DEPENDS+=$(3))
  endef

  define Package/luci-$(1)/install
	$(call Package/luci/install/template,$$(1),modules/admin-core)
	$(call Package/luci-$(1)/extra-install)
  endef

  ifneq ($(CONFIG_PACKAGE_luci-$(1)),)
    PKG_SELECTED_MODULES+=modules/$(1)
  endif

  BUILD_PACKAGES += luci-$(1)
endef


define Package/luci-admin-core/extra-install
	touch $(1)/etc/init.d/luci_fixtime || true
endef

define Package/luci-mod-freifunk/conffiles
/etc/config/freifunk
endef

$(eval $(call module,admin-core,Web UI Core module,+luci-web +luci-i18n-english))
$(eval $(call module,admin-mini,LuCI Essentials - stripped down and user-friendly,+luci-admin-core))
$(eval $(call module,admin-full,LuCI Administration - full-featured for full control,+luci-admin-core +luci-ipkg))
$(eval $(call module,admin-rpc,LuCI RPC - JSON-RPC API,+luci-json))
$(eval $(call module,mod-freifunk,LuCI Freifunk module,+luci-admin-full +luci-json +PACKAGE_luci-mod-freifunk:freifunk-firewall))

$(eval $(call module,niu,NIU - Next Generation Interface,+luci-admin-core @BROKEN))


### Applications ###
define application
  define Package/luci-app-$(1)
    $(call Package/luci/webtemplate)
    TITLE:=$(if $(2),$(2),LuCI $(1) application)
	$(if $(3),DEPENDS:=$(3))
  endef

  define Package/luci-app-$(1)/install
	$(call Package/luci/install/template,$$(1),applications/luci-$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-app-$(1)),)
    PKG_SELECTED_MODULES+=applications/luci-$(1)
  endif

  BUILD_PACKAGES += luci-app-$(1)
endef

define Package/luci-app-splash/conffiles
/etc/config/luci_splash
endef

define Package/luci-app-statistics/conffiles
/etc/config/luci_statistics
endef

define Package/luci-app-diag-devinfo/conffiles
/etc/config/luci_devinfo
endef


$(eval $(call application,ffwizard-leipzig,Freifunk Leipzig configuration wizard))

$(eval $(call application,siitwizard,SIIT IPv4-over-IPv6 configuration wizard,\
	+luci-admin-core +PACKAGE_luci-app-siitwizard:kmod-siit))

$(eval $(call application,firewall,Firmware and Portforwarding application,\
	+luci-admin-core +PACKAGE_luci-app-firewall:firewall))

$(eval $(call application,olsr,OLSR configuration and status module,\
	+luci-admin-full +PACKAGE_luci-app-olsr:olsrd-luci +PACKAGE_luci-app-olsr:olsrd-luci-mod-txtinfo))

$(eval $(call application,qos,Quality of Service configuration module,\
	+luci-admin-core +PACKAGE_luci-app-qos:qos-scripts))

$(eval $(call application,splash,Freifunk DHCP-Splash application,\
	+PACKAGE_luci-app-splash:luci-nixio +PACKAGE_luci-app-splash:tc \
	+PACKAGE_luci-app-splash:kmod-sched +PACKAGE_luci-app-splash:iptables-mod-nat-extra \
	+PACKAGE_luci-app-splash:iptables-mod-ipopt))

$(eval $(call application,statistics,LuCI Statistics Application,\
	+luci-admin-full +PACKAGE_luci-app-statistics:collectd \
	+PACKAGE_luci-app-statistics:rrdtool1 \
	+PACKAGE_luci-app-statistics:collectd-mod-rrdtool \
	+PACKAGE_luci-app-statistics:collectd-mod-wireless \
	+PACKAGE_luci-app-statistics:collectd-mod-interface \
	+PACKAGE_luci-app-statistics:collectd-mod-load))


$(eval $(call application,diag-core,LuCI Diagnostics Tools (Core),\
	+luci-admin-core))

$(eval $(call application,diag-devinfo,LuCI Diagnostics Tools (Device Info),\
	+PACKAGE_luci-app-diag-devinfo:luci-app-diag-core \
	+PACKAGE_luci-app-diag-devinfo:smap \
	+PACKAGE_luci-app-diag-devinfo:netdiscover \
	+PACKAGE_luci-app-diag-devinfo:mac-to-devinfo \
	+PACKAGE_luci-app-diag-devinfo:httping \
	+PACKAGE_luci-app-diag-devinfo:smap-to-devinfo \
	+PACKAGE_luci-app-diag-devinfo:netdiscover-to-devinfo))

$(eval $(call application,voice-core,LuCI Voice Software (Core),\
	+luci-admin-core))

$(eval $(call application,voide-diag,LuCI Voice Software (Diagnostics),\
	+PACKAGE_luci-app-voice-diag:luci-app-voice-core \
    +PACKAGE_luci-app-voice-diag:luci-app-diag-devinfo))


$(eval $(call application,upnp,Universal Plug & Play configuration module,\
	+luci-admin-core +PACKAGE_luci-app-upnp:miniupnpd))

$(eval $(call application,ntpc,NTP time synchronisation configuration module,\
	+luci-admin-core +PACKAGE_luci-app-ntpc:ntpclient))

$(eval $(call application,ddns,Dynamic DNS configuration module,\
	+luci-admin-core +PACKAGE_luci-app-ddns:ddns-scripts))

$(eval $(call application,samba,Network Shares - Samba SMB/CIFS module,\
	+luci-admin-full +PACKAGE_luci-app-samba:samba3))

$(eval $(call application,mmc-over-gpio,MMC-over-GPIO configuration module,\
	+luci-admin-full +PACKAGE_luci-app-mmc-over-gpio:kmod-mmc-over-gpio))

$(eval $(call application,p910nd,p910nd - Printer server module,\
	+luci-admin-full +PACKAGE_luci-app-p910nd:p910nd))

$(eval $(call application,ushare,uShare - UPnP A/V & DLNA Media Server,\
	+luci-admin-full +PACKAGE_luci-app-ushare:ushare))

$(eval $(call application,hd-idle,Hard Disk Idle Spin-Down module,\
	+luci-admin-full +PACKAGE_luci-app-hd-idle:hd-idle))

$(eval $(call application,tinyproxy,Tinyproxy - HTTP(S)-Proxy configuration,\
	+luci-admin-full +PACKAGE_luci-app-tinyproxy:tinyproxy))

$(eval $(call application,initmgr,LuCI Initscript Management,\
	+luci-admin-full))

$(eval $(call application,livestats,LuCI Realtime Statistics,\
	+luci-admin-core +luci-admin-rpc))

$(eval $(call application,asterisk,LuCI Support for Asterisk PBX,\
	@BROKEN +luci-admin-core +PACKAGE_luci-app-asterisk:asterisk14-xip-core))

$(eval $(call application,polipo,LuCI Support for the Polipo Proxy,\
	+luci-admin-core +PACKAGE_luci-app-polipo:polipo))

$(eval $(call application,openvpn,LuCI Support for OpenVPN,\
	+luci-admin-core +PACKAGE_luci-app-openvpn:openvpn))

$(eval $(call application,p2pblock,LuCI Support for the Freifunk P2P-Block addon,\
	+luci-admin-core +luci-app-firewall +PACKAGE_luci-app-p2pblock:freifunk-p2pblock))

$(eval $(call application,multiwan,LuCI Support for the OpenWrt MultiWAN agent,\
	+luci-admin-core +luci-app-firewall +PACKAGE_luci-app-multiwan:multiwan))

$(eval $(call application,wol,LuCI Support for Wake-on-LAN,\
	+luci-admin-core +PACKAGE_luci-app-wol:etherwake))

$(eval $(call application,vnstat,LuCI Support for VnStat,\
	+luci-admin-core +PACKAGE_luci-app-vnstat:vnstat \
    +PACKAGE_luci-app-vnstat:vnstati))


### Server Gateway Interfaces ###
define sgi
  define Package/luci-sgi-$(1)
    $(call Package/luci/webservertemplate)
    TITLE:=$(if $(2),$(2),LuCI $(1) server gateway interface)
	$(if $(3),DEPENDS:=$(3))
  endef

  define Package/luci-sgi-$(1)/install
	$(call Package/luci/install/template,$$(1),libs/sgi-$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-sgi-$(1)),)
    PKG_SELECTED_MODULES+=libs/sgi-$(1)
  endif

  BUILD_PACKAGES += luci-sgi-$(1)
endef

$(eval $(call sgi,cgi,CGI Gateway behind existing Webserver))
$(eval $(call sgi,uhttpd,Binding for the uHTTPd server,+uhttpd +uhttpd-mod-lua))


### Themes ###
define theme
  define Package/luci-theme-$(1)
    $(call Package/luci/thtemplate)
    TITLE:=$(if $(2),$(2),LuCI $(1) theme)
	$(if $(3),MAINTAINER:=$(3))
	$(if $(4),DEPENDS:=$(4))
	$(if $(5),DEFAULT:=y if PACKAGE_luci-core)
  endef

  define Package/luci-theme-$(1)/install
	$(call Package/luci/install/template,$$(1),themes/$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-theme-$(1)),)
    PKG_SELECTED_MODULES+=themes/$(1)
  endif

  BUILD_PACKAGES += luci-theme-$(1)
endef

$(eval $(call theme,base,Common base for all themes,\
	LuCI developers <luci-at-lists-dot-subsignal.org>))

$(eval $(call theme,openwrt,OpenWrt.org (default),\
	LuCI developers <luci-at-lists-dot-subsignal.org>,\
	+luci-theme-base luci-core,1))

$(eval $(call theme,openwrtlight,OpenWrt.org - light variant without images,\
	LuCI developers <luci-at-lists-dot-subsignal.org>,+luci-theme-base))

$(eval $(call theme,fledermaus,Fledermaus Theme,\
	LuCI developers <luci-at-lists-dot-subsignal.org>,+luci-web))

$(eval $(call theme,freifunk,alternative Freifunk Theme,\
	Stefan Pirwitz <stefan-at-freifunk-bno-dot-de>,+luci-web))

$(eval $(call theme,freifunk-bno,Freifunk Berlin Nordost Theme,\
	Stefan Pirwitz <stefan-at-freifunk-bno-dot-de>,+luci-web))

$(eval $(call theme,freifunk-hannover,Freifunk Hannover Theme,\
	Mikolas Bingemer <mickey-at-freifunk-hannover-dot-de>,+luci-web))


### Translations ###
define translation
  define Package/luci-i18n-$(1)
    $(call Package/luci/i18ntemplate)
    TITLE:=$(if $(2),$(2),$(1))
  endef

  define Package/luci-i18n-$(1)/install
	$(call Package/luci/install/template,$$(1),i18n/$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-i18n-$(1)),)
    PKG_SELECTED_MODULES+=i18n/$(1)
  endif

  BUILD_PACKAGES += luci-i18n-$(1)
endef

$(eval $(call translation,german,German))
$(eval $(call translation,english,English))
$(eval $(call translation,french,French (by Florian Fainelli)))
$(eval $(call translation,italian,Italian (by Matteo Croce)))
$(eval $(call translation,russian,Russian (by Skryabin Dmitry)))
$(eval $(call translation,portuguese_brazilian,Portuguese (Brazilian) (by Carlos Cesario)))
$(eval $(call translation,japanese,Japanese (by Tsukasa Hamano)))
$(eval $(call translation,greek,Greek (by Vasilis Tsiligiannis)))
$(eval $(call translation,catalan,Catalan (by Eduard Duran)))
$(eval $(call translation,portuguese,Portuguese (by Jose Monteiro)))
$(eval $(call translation,spanish,Spanish (by Guillermo Javier Nardoni)))
$(eval $(call translation,vietnamese,Vietnamese (by Hong Phuc Dang)))
$(eval $(call translation,malay,Malay (by Teow Wai Chet)))
$(eval $(call translation,norwegian,Norwegian (by Lars Hardy)))


### Collections ###
define collection
  define Package/$(1)
    $(call Package/luci/collectiontemplate)
    TITLE:=$(if $(2),$(2),LuCI $(1) collection)
    $(if $(3),DEPENDS:=$(3))
  endef

  define Package/$(1)/install
	true
  endef

  BUILD_PACKAGES += $(1)
endef

$(eval $(call collection,luci,\
	Standard OpenWrt set including full and mini admin and the standard theme,\
	+uhttpd +luci-admin-full +luci-admin-mini +luci-theme-openwrt \
    +luci-app-firewall +luci-app-initmgr))

$(eval $(call collection,luci-ssl,\
	Standard OpenWrt set with HTTPS support,\
	+uhttpd +uhttpd-mod-tls +px5g +luci-admin-full +luci-admin-mini \
    +luci-theme-openwrt +luci-app-firewall +luci-app-initmgr))

$(eval $(call collection,luci-medium,\
	Medium package set using only admin full and a theme without graphics,\
	+uhttpd +luci-admin-full +luci-theme-openwrtlight))

$(eval $(call collection,luci-light,\
	Minimum package set using only admin mini and a theme without graphics,\
	+uhttpd +luci-admin-mini +luci-theme-openwrtlight))


$(foreach b,$(BUILD_PACKAGES),$(eval $(call BuildPackage,$(b))))
