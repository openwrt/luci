include $(TOPDIR)/rules.mk

PKG_BRANCH:=branches/luci-0.11

ifeq ($(DUMP),)
  USELOCAL:=$(shell grep luci ../../../.project 2>/dev/null >/dev/null && echo 1)
endif

PKG_NAME:=luci
PKG_RELEASE:=1

PKG_BUILD_PARALLEL:=0

ifeq ($(USELOCAL),1)
  PKG_VERSION:=0.11+svn
else
  PKG_SOURCE_URL:=http://svn.luci.subsignal.org/luci/$(PKG_BRANCH)
  ifeq ($(DUMP),)
    PKG_REV:=$(shell LC_ALL=C svn info $(CURDIR) | sed -ne's/^Revision: //p')
    PKG_VERSION:=0.11+svn$(PKG_REV)
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
LUCI_BUILD_PACKAGES:=
LUCI_SELECTED_MODULES:=

ifeq ($(BOARD),brcm-2.4)
  MAKE_FLAGS += CRAP="1"
endif


### Templates ###
define Package/luci/install/template
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/ipkg/* $(1)/CONTROL/ 2>/dev/null || true
endef


### Core package ###
define Package/luci-lib-core
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=LuCI - Lua Configuration Interface
  URL:=http://luci.subsignal.org/
  MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
  SUBMENU:=8. Libraries
  DEPENDS:=+lua +libuci-lua +libubus-lua
  TITLE:=LuCI core libraries
endef

define Package/luci-lib-core/install
	$(call Package/luci/install/template,$(1),libs/core)
	$(PKG_BUILD_DIR)/build/mkversion.sh $(1)/usr/lib/lua/luci/version.lua \
		"OpenWrt Firmware" \
		"$(OPENWRTVERSION)" \
		"$(PKG_BRANCH)" \
		"$(PKG_VERSION)"
endef

define Package/luci-lib-core/config
       choice
               prompt "Build Target"
               default PACKAGE_luci-lib-core_source

       config PACKAGE_luci-lib-core_compile
               bool "Precompiled"

       config PACKAGE_luci-lib-core_stripped
               bool "Stripped"

       config PACKAGE_luci-lib-core_srcdiet
               bool "Compressed Source"

       config PACKAGE_luci-lib-core_source
               bool "Full Source"

       endchoice
endef

ifneq ($(CONFIG_PACKAGE_luci-lib-core_compile),)
  LUA_TARGET:=compile
endif

ifneq ($(CONFIG_PACKAGE_luci-lib-core_stripped),)
  LUA_TARGET:=strip
endif

ifneq ($(CONFIG_PACKAGE_luci-lib-core_srcdiet),)
  LUA_TARGET:=diet
endif

ifneq ($(CONFIG_PACKAGE_luci-lib-core),)
  LUCI_SELECTED_MODULES+=libs/core
endif

LUCI_BUILD_PACKAGES += luci-lib-core


### Libraries ###
define library
  define Package/luci-lib-$(1)
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=LuCI - Lua Configuration Interface
    URL:=http://luci.subsignal.org/
    MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
    SUBMENU:=8. Libraries
    TITLE:=$(if $(2),$(2),LuCI $(1) library)
    $(if $(3),DEPENDS:=+luci-lib-core $(3))
  endef

  define Package/luci-lib-$(1)/install
	$(call Package/luci/install/template,$$(1),libs/$(1))
	$(call Package/luci-lib-$(1)/extra-install)
  endef

  ifneq ($(CONFIG_PACKAGE_luci-lib-$(1)),)
    LUCI_SELECTED_MODULES+=libs/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-lib-$(1)
endef

define Package/luci-lib-web/conffiles
/etc/config/luci
endef

define Package/luci-lib-nixio/config
	choice
		prompt "TLS Provider"
		default PACKAGE_luci-lib-nixio_notls

		config PACKAGE_luci-lib-nixio_notls
			bool "Disabled"

		config PACKAGE_luci-lib-nixio_axtls
			bool "Builtin (axTLS)"

		config PACKAGE_luci-lib-nixio_cyassl
			bool "CyaSSL"
			select PACKAGE_libcyassl

		config PACKAGE_luci-lib-nixio_openssl
			bool "OpenSSL"
			select PACKAGE_libopenssl
	endchoice
endef


NIXIO_TLS:=

ifneq ($(CONFIG_PACKAGE_luci-lib-nixio_axtls),)
  NIXIO_TLS:=axtls
endif

ifneq ($(CONFIG_PACKAGE_luci-lib-nixio_openssl),)
  NIXIO_TLS:=openssl
endif

ifneq ($(CONFIG_PACKAGE_luci-lib-nixio_cyassl),)
  NIXIO_TLS:=cyassl
  LUCI_CFLAGS+=-I$(STAGING_DIR)/usr/include/cyassl
endif


$(eval $(call library,fastindex,Fastindex indexing module,+PACKAGE_luci-lib-fastindex:liblua))
$(eval $(call library,httpclient,HTTP(S) client library,+luci-lib-web +luci-lib-nixio))
$(eval $(call library,ipkg,LuCI IPKG/OPKG call abstraction library))
$(eval $(call library,json,LuCI JSON library))
$(eval $(call library,lucid,LuCId Full-Stack Webserver,+luci-lib-nixio +luci-lib-web +luci-lib-px5g))
$(eval $(call library,lucid-http,LuCId HTTP Backend,+luci-lib-lucid))
$(eval $(call library,lucid-rpc,LuCId RPC Backend,+luci-lib-lucid))
$(eval $(call library,nixio,NIXIO POSIX library,+PACKAGE_luci-lib-nixio_openssl:libopenssl +PACKAGE_luci-lib-nixio_cyassl:libcyassl))
$(eval $(call library,px5g,RSA/X.509 Key Generator (required for LuCId SSL support),+luci-lib-nixio))
$(eval $(call library,sys,LuCI Linux/POSIX system library))
$(eval $(call library,web,MVC Webframework,+luci-lib-sys +luci-lib-nixio +luci-lib-core +luci-sgi-cgi))


### Protocols ###
define protocol
  define Package/luci-proto-$(1)
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=LuCI - Lua Configuration Interface
    URL:=http://luci.subsignal.org/
    MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
    SUBMENU:=6. Protocols
    TITLE:=$(if $(2),$(2),LuCI $(1) protocol support)
    DEPENDS:=$(3)
  endef

  define Package/luci-proto-$(1)/install
	$(call Package/luci/install/template,$$(1),protocols/$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-proto-$(1)),)
    LUCI_SELECTED_MODULES+=protocols/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-proto-$(1)
endef

$(eval $(call protocol,core,Support for static/dhcp/none))
$(eval $(call protocol,ppp,Support for PPP/PPPoE/PPPoA/PPtP))
$(eval $(call protocol,ipv6,Support for DHCPv6/6in4/6to4/6rd/DS-Lite))
$(eval $(call protocol,3g,Support for 3G,+PACKAGE_luci-proto-3g:comgt))
$(eval $(call protocol,relay,Support for relayd pseudo bridges,+PACKAGE_luci-proto-relay:relayd))


### Community Packages ###
define Package/luci-mod-freifunk-community
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=LuCI - Lua Configuration Interface
  URL:=http://luci.subsignal.org/
  MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
  SUBMENU:=9. Freifunk
  TITLE:=Freifunk Community Meta-Package
  DEPENDS+= \
   +luci-lib-web +luci-app-splash +luci-i18n-german \
   +PACKAGE_luci-mod-freifunk-community:olsrd +PACKAGE_luci-mod-freifunk-community:olsrd-mod-dyn-gw-plain \
   +PACKAGE_luci-mod-freifunk-community:olsrd-mod-txtinfo +PACKAGE_luci-mod-freifunk-community:olsrd-mod-nameservice \
   +PACKAGE_luci-mod-freifunk-community:olsrd-mod-watchdog +PACKAGE_luci-mod-freifunk-community:kmod-tun \
   +PACKAGE_luci-mod-freifunk-community:ip +PACKAGE_luci-mod-freifunk-community:freifunk-watchdog +luci-app-olsr \
   +luci-app-olsr-services +freifunk-gwcheck +freifunk-mapupdate
endef

define Package/luci-mod-freifunk-community/install
	$(call Package/luci/install/template,$(1),applications/freifunk-community)
endef

ifneq ($(CONFIG_PACKAGE_luci-mod-freifunk-community),)
	LUCI_SELECTED_MODULES+=applications/freifunk-community
endif

LUCI_BUILD_PACKAGES += luci-mod-freifunk-community


### Modules ###
define module
  define Package/luci-mod-$(1)
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=LuCI - Lua Configuration Interface
    URL:=http://luci.subsignal.org/
    MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
    SUBMENU:=2. Modules
    TITLE:=$(if $(2),$(2),LuCI $(1) module)
    $(if $(3),DEPENDS+=$(3))
  endef

  define Package/luci-mod-$(1)/install
	$(call Package/luci/install/template,$$(1),modules/$(1))
	$(call Package/luci-mod-$(1)/extra-install)
  endef

  ifneq ($(CONFIG_PACKAGE_luci-mod-$(1)),)
    LUCI_SELECTED_MODULES+=modules/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-mod-$(1)
endef


define Package/luci-mod-admin-core/extra-install
	touch $(1)/etc/init.d/luci_fixtime || true
endef

$(eval $(call module,admin-core,Web UI Core module,+luci-lib-web +luci-proto-core +luci-i18n-english))
$(eval $(call module,admin-mini,LuCI Essentials - stripped down and user-friendly,+luci-mod-admin-core @BROKEN))
$(eval $(call module,admin-full,LuCI Administration - full-featured for full control,+luci-mod-admin-core +luci-lib-ipkg))
$(eval $(call module,failsafe,LuCI Fail-Safe - Fail-Safe sysupgrade module,+luci-mod-admin-core))
$(eval $(call module,rpc,LuCI RPC - JSON-RPC API,+luci-lib-json))
$(eval $(call module,freifunk,LuCI Freifunk module,+luci-mod-admin-full +luci-lib-json +PACKAGE_luci-mod-freifunk:freifunk-firewall +freifunk-common +community-profiles))
$(eval $(call module,niu,NIU - Next Generation Interface,+luci-mod-admin-core @BROKEN))


### Applications ###
define application
  define Package/luci-app-$(1)
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=LuCI - Lua Configuration Interface
    URL:=http://luci.subsignal.org/
    MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
    SUBMENU:=3. Applications
    TITLE:=$(if $(2),$(2),LuCI $(1) application)
	DEPENDS:=$(3)
  endef

  define Package/luci-app-$(1)/install
	$(call Package/luci/install/template,$$(1),applications/luci-$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-app-$(1)),)
    LUCI_SELECTED_MODULES+=applications/luci-$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-app-$(1)
endef

define Package/luci-app-splash/conffiles
/etc/config/luci_splash
/usr/lib/luci-splash/splashtext.html
endef

define Package/luci-app-statistics/conffiles
/etc/config/luci_statistics
endef

define Package/luci-app-diag-devinfo/conffiles
/etc/config/luci_devinfo
endef


$(eval $(call application,siitwizard,SIIT IPv4-over-IPv6 configuration wizard,\
	+PACKAGE_luci-app-siitwizard:kmod-siit))

$(eval $(call application,firewall,Firewall and Portforwarding application,\
	+PACKAGE_luci-app-firewall:firewall))

$(eval $(call application,freifunk-policyrouting,Policy routing for mesh traffic,\
        +PACKAGE_luci-app-freifunk-policyrouting:freifunk-policyrouting))

$(eval $(call application,freifunk-widgets,Widgets for the Freifunk index page,\
        +PACKAGE_luci-app-freifunk-widgets:luci-mod-freifunk))

$(eval $(call application,meshwizard, Shellscript based wizard to setup mesh networks,\
        +PACKAGE_luci-app-freifunk-meshwizard:meshwizard))

$(eval $(call application,olsr,OLSR configuration and status module,\
	+olsrd-mod-txtinfo))

$(eval $(call application,olsr-viz,OLSR Visualisation,\
	luci-app-olsr +olsrd-mod-txtinfo))

$(eval $(call application,freifunk-diagnostics,Tools for network diagnosis like traceroute and ping))

$(eval $(call application,olsr-services,Show services announced with the nameservice plugin,\
	luci-app-olsr +olsrd-mod-nameservice))

$(eval $(call application,qos,Quality of Service configuration module,\
	+PACKAGE_luci-app-qos:qos-scripts))

$(eval $(call application,splash,Freifunk DHCP-Splash application,\
	+luci-lib-nixio +tc +kmod-sched +iptables-mod-nat-extra +iptables-mod-ipopt))

$(eval $(call application,statistics,LuCI Statistics Application,\
	+PACKAGE_luci-app-statistics:collectd \
	+PACKAGE_luci-app-statistics:rrdtool1 \
	+PACKAGE_luci-app-statistics:collectd-mod-rrdtool \
	+PACKAGE_luci-app-statistics:collectd-mod-iwinfo \
	+PACKAGE_luci-app-statistics:collectd-mod-interface \
	+PACKAGE_luci-app-statistics:collectd-mod-load)) \
	+PACKAGE_luci-app-statistics:collectd-mod-network))


$(eval $(call application,diag-core,LuCI Diagnostics Tools (Core)))

$(eval $(call application,diag-devinfo,LuCI Diagnostics Tools (Device Info),\
	+luci-app-diag-core \
	+PACKAGE_luci-app-diag-devinfo:smap \
	+PACKAGE_luci-app-diag-devinfo:netdiscover \
	+PACKAGE_luci-app-diag-devinfo:mac-to-devinfo \
	+PACKAGE_luci-app-diag-devinfo:httping \
	+PACKAGE_luci-app-diag-devinfo:smap-to-devinfo \
	+PACKAGE_luci-app-diag-devinfo:netdiscover-to-devinfo))

$(eval $(call application,voice-core,LuCI Voice Software (Core)))

$(eval $(call application,voice-diag,LuCI Voice Software (Diagnostics),\
	luci-app-diag-devinfo))

$(eval $(call application,commands,LuCI Shell Command Module))

$(eval $(call application,upnp,Universal Plug & Play configuration module,\
	+PACKAGE_luci-app-upnp:miniupnpd))

$(eval $(call application,ntpc,NTP time synchronisation configuration module,\
	+PACKAGE_luci-app-ntpc:ntpclient))

$(eval $(call application,ddns,Dynamic DNS configuration module,\
	+PACKAGE_luci-app-ddns:ddns-scripts))

$(eval $(call application,samba,Network Shares - Samba SMB/CIFS module,\
	+PACKAGE_luci-app-samba:samba36-server))

$(eval $(call application,mmc-over-gpio,MMC-over-GPIO configuration module,\
	+PACKAGE_luci-app-mmc-over-gpio:kmod-mmc-over-gpio))

$(eval $(call application,p910nd,p910nd - Printer server module,\
	+PACKAGE_luci-app-p910nd:p910nd))

$(eval $(call application,ushare,uShare - UPnP A/V & DLNA Media Server,\
	+PACKAGE_luci-app-ushare:ushare))

$(eval $(call application,hd-idle,Hard Disk Idle Spin-Down module,\
	+PACKAGE_luci-app-hd-idle:hd-idle))

$(eval $(call application,tinyproxy,Tinyproxy - HTTP(S)-Proxy configuration,\
	+PACKAGE_luci-app-tinyproxy:tinyproxy))

$(eval $(call application,polipo,LuCI Support for the Polipo Proxy,\
	+PACKAGE_luci-app-polipo:polipo))

$(eval $(call application,openvpn,LuCI Support for OpenVPN,\
	+PACKAGE_luci-app-openvpn:openvpn @BROKEN))

$(eval $(call application,p2pblock,LuCI Support for the Freifunk P2P-Block addon,\
	luci-app-firewall +PACKAGE_luci-app-p2pblock:freifunk-p2pblock))

$(eval $(call application,multiwan,LuCI Support for the OpenWrt MultiWAN agent,\
	luci-app-firewall +PACKAGE_luci-app-multiwan:multiwan))

$(eval $(call application,wol,LuCI Support for Wake-on-LAN,\
	+PACKAGE_luci-app-wol:etherwake))

$(eval $(call application,vnstat,LuCI Support for VnStat,\
	+PACKAGE_luci-app-vnstat:vnstat \
    +PACKAGE_luci-app-vnstat:vnstati))

$(eval $(call application,radvd,LuCI Support for Radvd,\
	+PACKAGE_luci-app-radvd:radvd))

$(eval $(call application,ahcp,LuCI Support for AHCPd,\
	+PACKAGE_luci-app-ahcp:ahcpd))

$(eval $(call application,wshaper,LuCI Support for wshaper,\
	+PACKAGE_luci-app-wshaper:wshaper))

$(eval $(call application,pbx,LuCI PBX Administration,\
	+PACKAGE_luci-app-pbx:asterisk18 \
	+PACKAGE_luci-app-pbx:asterisk18-app-authenticate \
	+PACKAGE_luci-app-pbx:asterisk18-app-disa \
	+PACKAGE_luci-app-pbx:asterisk18-app-setcallerid \
	+PACKAGE_luci-app-pbx:asterisk18-app-system \
	+PACKAGE_luci-app-pbx:asterisk18-chan-gtalk \
	+PACKAGE_luci-app-pbx:asterisk18-codec-a-mu \
	+PACKAGE_luci-app-pbx:asterisk18-codec-alaw \
	+PACKAGE_luci-app-pbx:asterisk18-func-cut \
	+PACKAGE_luci-app-pbx:asterisk18-res-clioriginate))

$(eval $(call application,pbx-voicemail,LuCI PBX Administration Voicemail Support,\
	luci-app-pbx +PACKAGE_luci-app-pbx-voicemail:msmtp))

$(eval $(call application,ltqtapi,Lantiq voip))

$(eval $(call application,minidlna,LuCI Support for miniDLNA,\
	+PACKAGE_luci-app-minidlna:minidlna))

$(eval $(call application,transmission,LuCI Support for Transmission,\
	+PACKAGE_luci-app-transmission:transmission-daemon))

$(eval $(call application,watchcat,LuCI Support for Watchcat,\
	+PACKAGE_luci-app-watchcat:watchcat))

### Server Gateway Interfaces ###
define sgi
  define Package/luci-sgi-$(1)
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=LuCI - Lua Configuration Interface
    URL:=http://luci.subsignal.org/
    MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
    SUBMENU:=7. Server Interfaces
    TITLE:=$(if $(2),$(2),LuCI $(1) server gateway interface)
	DEPENDS:=$(3)
  endef

  define Package/luci-sgi-$(1)/install
	$(call Package/luci/install/template,$$(1),libs/sgi-$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-sgi-$(1)),)
    LUCI_SELECTED_MODULES+=libs/sgi-$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-sgi-$(1)
endef

$(eval $(call sgi,cgi,CGI Gateway behind existing Webserver))
$(eval $(call sgi,uhttpd,Binding for the uHTTPd server,+uhttpd +uhttpd-mod-lua))


### Themes ###
define theme
  define Package/luci-theme-$(1)
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=LuCI - Lua Configuration Interface
    URL:=http://luci.subsignal.org/
    SUBMENU:=4. Themes
    TITLE:=$(if $(2),$(2),LuCI $(1) theme)
	MAINTAINER:=$(if $(3),$(3),LuCI Development Team <luci@lists.subsignal.org>)
	DEPENDS:=$(if $(filter-out base,$(1)),+luci-theme-base) $(4)
	$(if $(5),DEFAULT:=PACKAGE_luci-lib-core)
  endef

  define Package/luci-theme-$(1)/install
	$(call Package/luci/install/template,$$(1),themes/$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-theme-$(1)),)
    LUCI_SELECTED_MODULES+=themes/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-theme-$(1)
endef

$(eval $(call theme,base,Common base for all themes))
$(eval $(call theme,openwrt,OpenWrt.org (default),,,1))
$(eval $(call theme,bootstrap,Bootstrap Theme))

$(eval $(call theme,freifunk-bno,Freifunk Berlin Nordost Theme,\
	Stefan Pirwitz <stefan-at-freifunk-bno-dot-de>))

$(eval $(call theme,freifunk-generic,Freifunk Generic Theme,\
	Manuel Munz <freifunk-at-somakoma-dot-de>))

### Translations ###
define translation
  define Package/luci-i18n-$(1)
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=LuCI - Lua Configuration Interface
    URL:=http://luci.subsignal.org/
    MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
    SUBMENU:=5. Translations
    TITLE:=$(if $(2),$(2),$(1))
  endef

  define Package/luci-i18n-$(1)/install
	$(call Package/luci/install/template,$$(1),i18n/$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-i18n-$(1)),)
    LUCI_SELECTED_MODULES+=i18n/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-i18n-$(1)
endef

$(eval $(call translation,german,German))
$(eval $(call translation,english,English))
$(eval $(call translation,french,French (by Florian Fainelli)))
$(eval $(call translation,italian,Italian (by Matteo Croce)))
$(eval $(call translation,russian,Russian (by Skryabin Dmitry)))
$(eval $(call translation,portuguese-brazilian,Portuguese (Brazilian) (by Carlos Cesario)))
$(eval $(call translation,chinese,Chinese (by Chinese Translators)))
$(eval $(call translation,japanese,Japanese (by Tsukasa Hamano)))
$(eval $(call translation,greek,Greek (by Vasilis Tsiligiannis)))
$(eval $(call translation,catalan,Catalan (by Eduard Duran)))
$(eval $(call translation,portuguese,Portuguese (by Jose Monteiro)))
$(eval $(call translation,spanish,Spanish (by Guillermo Javier Nardoni)))
$(eval $(call translation,vietnamese,Vietnamese (by Hong Phuc Dang)))
$(eval $(call translation,malay,Malay (by Teow Wai Chet)))
$(eval $(call translation,norwegian,Norwegian (by Lars Hardy)))
$(eval $(call translation,hebrew,Hebrew))
$(eval $(call translation,romanian,Romanian))
$(eval $(call translation,ukrainian,Ukrainian))
$(eval $(call translation,hungarian,Hungarian))
$(eval $(call translation,polish,Polish))


### Collections ###
define collection
  define Package/luci$(if $(1),-$(1))
    SECTION:=luci
    CATEGORY:=LuCI
    TITLE:=LuCI - Lua Configuration Interface
    URL:=http://luci.subsignal.org/
    MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
    SUBMENU:=1. Collections
    TITLE:=$(if $(2),$(2),LuCI $(if $(1),$(1),general) collection)
    $(if $(3),DEPENDS:=$(3))
  endef

  define Package/luci$(if $(1),-$(1))/install
	true
  endef

  LUCI_BUILD_PACKAGES += luci$(if $(1),-$(1))
endef

$(eval $(call collection,,\
	Standard OpenWrt set including full admin with ppp support and the \
	default OpenWrt theme,\
	+uhttpd +luci-mod-admin-full +luci-theme-openwrt +luci-app-firewall \
	+luci-proto-core +luci-proto-ppp +libiwinfo-lua))

$(eval $(call collection,ssl,\
	Standard OpenWrt set with HTTPS support,\
	+luci +uhttpd-mod-tls +px5g))

$(eval $(call collection,light,\
	Minimum package set using only admin mini and the standard theme,\
	+uhttpd +luci-mod-admin-mini +luci-theme-openwrt @BROKEN))


### Compile ###
PKG_CONFIG_DEPENDS=$(patsubst %,CONFIG_PACKAGE_%,$(LUCI_BUILD_PACKAGES))

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
	MODULES="$(LUCI_SELECTED_MODULES)" \
	LUA_TARGET="$(LUA_TARGET)" \
	LUA_SHLIBS="-llua -lm -ldl -lcrypt" \
	CFLAGS="$(TARGET_CFLAGS) $(LUCI_CFLAGS) -I$(STAGING_DIR)/usr/include" \
	LDFLAGS="$(TARGET_LDFLAGS) -L$(STAGING_DIR)/usr/lib" \
	NIXIO_TLS="$(NIXIO_TLS)" OS="Linux"


$(foreach b,$(LUCI_BUILD_PACKAGES),$(eval $(call BuildPackage,$(b))))
