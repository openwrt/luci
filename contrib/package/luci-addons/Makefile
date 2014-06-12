include $(TOPDIR)/rules.mk

LUCI_TOPDIR=../../..

PKG_NAME:=luci-addons
PKG_RELEASE:=1

PKG_BUILD_PARALLEL:=0

PKG_VERSION:=$(shell $(LUCI_TOPDIR)/build/mkrevision.sh 2>/dev/null || echo unknown)

PKG_BUILD_DEPENDS:=$(if $(STAGING_DIR_ROOT),lua/host)
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install
PKG_USE_MIPS16:=0

LUA_TARGET:=source
LUCI_CFLAGS:=
LUCI_BUILD_PACKAGES:=
LUCI_SELECTED_MODULES:=


# 1: luci component
# 2: package names
define add_deps
	$(foreach dep,$(2), \
		$(if $(patsubst @%,,$(dep)), \
			$(if $(patsubst luci-%,,$(dep)), \
				+PACKAGE_luci-$(1):$(dep), \
				+$(dep)), \
			$(dep)))
endef

### Templates ###
define Package/luci-addons/install/template
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/ipkg/* $(1)/CONTROL/ 2>/dev/null || true
endef


### Community Packages ###
define Package/luci-mod-freifunk-community
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=LuCI - Lua Configuration Interface
  URL:=http://luci.subsignal.org/
  MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
  SUBMENU:=9. Freifunk
  TITLE:=Freifunk Community Meta-Package
  DEPENDS+=$(call add_deps,mod-freifunk-community, \
    iptables-mod-nat-extra iptables-mod-ipopt \
	luci-app-splash luci-i18n-german \
	olsrd olsrd-mod-dyn-gw-plain \
	olsrd-mod-jsoninfo olsrd-mod-nameservice \
	olsrd-mod-watchdog kmod-tun \
	ip freifunk-watchdog luci-app-olsr \
	luci-app-olsr-services freifunk-gwcheck freifunk-mapupdate \
  )
endef

define Package/luci-mod-freifunk-community/install
	$(call Package/luci-addons/install/template,$(1),applications/freifunk-community)
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
	$(call Package/luci-addons/install/template,$$(1),modules/$(1))
	$(call Package/luci-mod-$(1)/extra-install)
  endef

  ifneq ($(CONFIG_PACKAGE_luci-mod-$(1)),)
    LUCI_SELECTED_MODULES+=modules/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-mod-$(1)
endef


$(eval $(call module,freifunk,LuCI Freifunk module,+luci-mod-admin-full +luci-lib-json +PACKAGE_luci-mod-freifunk:freifunk-firewall +freifunk-common))


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
	DEPENDS:=$(call add_deps,app-$(1),$(3))
  endef

  define Package/luci-app-$(1)/install
	$(call Package/luci-addons/install/template,$$(1),applications/luci-$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-app-$(1)),)
    LUCI_SELECTED_MODULES+=applications/luci-$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-app-$(1)
endef

define Package/luci-app-splash/conffiles
/etc/config/luci_splash
/usr/lib/luci-splash/splashtext.html
/usr/lib/luci-splash/splashtextinclude.html
endef

define Package/luci-app-statistics/conffiles
/etc/config/luci_statistics
endef

define Package/luci-app-diag-devinfo/conffiles
/etc/config/luci_devinfo
endef


$(eval $(call application,siitwizard,SIIT IPv4-over-IPv6 configuration wizard,kmod-siit))
$(eval $(call application,freifunk-policyrouting,Policy routing for mesh traffic,freifunk-policyrouting))
$(eval $(call application,freifunk-widgets,Widgets for the Freifunk index page,luci-mod-freifunk))
$(eval $(call application,meshwizard, Shellscript based wizard to setup mesh networks,meshwizard))
$(eval $(call application,olsr,OLSR configuration and status module,olsrd olsrd-mod-jsoninfo luci-lib-luaneightbl))
$(eval $(call application,olsr-viz,OLSR Visualisation,luci-app-olsr olsrd olsrd-mod-txtinfo))
$(eval $(call application,freifunk-diagnostics,Tools for network diagnosis like traceroute and ping))
$(eval $(call application,olsr-services,Show services announced with the nameservice plugin,luci-app-olsr olsrd olsrd-mod-nameservice))
$(eval $(call application,splash,Freifunk DHCP-Splash application,luci-lib-nixio tc kmod-sched iptables-mod-nat-extra iptables-mod-ipopt))

$(eval $(call application,statistics,LuCI Statistics Application,\
	collectd \
	rrdtool1 \
	collectd-mod-rrdtool \
	collectd-mod-iwinfo \
	collectd-mod-interface \
	collectd-mod-load \
	collectd-mod-network))


$(eval $(call application,diag-core,LuCI Diagnostics Tools (Core)))

$(eval $(call application,diag-devinfo,LuCI Diagnostics Tools (Device Info),\
	luci-app-diag-core \
	smap \
	netdiscover \
	mac-to-devinfo \
	httping \
	smap-to-devinfo \
	netdiscover-to-devinfo))

$(eval $(call application,voice-core,LuCI Voice Software (Core)))
$(eval $(call application,voice-diag,LuCI Voice Software (Diagnostics),luci-app-diag-devinfo))

$(eval $(call application,upnp,Universal Plug & Play configuration module,miniupnpd))
$(eval $(call application,ntpc,NTP time synchronisation configuration module,ntpclient))
$(eval $(call application,ddns,Dynamic DNS configuration module,ddns-scripts))
$(eval $(call application,samba,Network Shares - Samba SMB/CIFS module,samba36-server))
$(eval $(call application,mmc-over-gpio,MMC-over-GPIO configuration module,kmod-mmc-over-gpio))
$(eval $(call application,p910nd,p910nd - Printer server module,p910nd))
$(eval $(call application,ushare,uShare - UPnP A/V & DLNA Media Server,ushare))
$(eval $(call application,hd-idle,Hard Disk Idle Spin-Down module,hd-idle))
$(eval $(call application,tinyproxy,Tinyproxy - HTTP(S)-Proxy configuration,tinyproxy))
$(eval $(call application,polipo,LuCI Support for the Polipo Proxy,polipo))
$(eval $(call application,openvpn,LuCI Support for OpenVPN,openvpn @BROKEN))
$(eval $(call application,p2pblock,LuCI Support for the Freifunk P2P-Block addon,luci-app-firewall freifunk-p2pblock))
$(eval $(call application,multiwan,LuCI Support for the OpenWrt MultiWAN agent,luci-app-firewall multiwan))
$(eval $(call application,wol,LuCI Support for Wake-on-LAN,etherwake))
$(eval $(call application,vnstat,LuCI Support for VnStat,vnstat vnstati))
$(eval $(call application,radvd,LuCI Support for Radvd,radvd))
$(eval $(call application,ahcp,LuCI Support for AHCPd,ahcpd))
$(eval $(call application,wshaper,LuCI Support for wshaper,wshaper))

$(eval $(call application,pbx,LuCI PBX Administration,\
	asterisk18 \
	asterisk18-app-authenticate \
	asterisk18-app-disa \
	asterisk18-app-setcallerid \
	asterisk18-app-system \
	asterisk18-chan-gtalk \
	asterisk18-codec-a-mu \
	asterisk18-codec-alaw \
	asterisk18-func-cut \
	asterisk18-res-clioriginate \
	asterisk18-func-channel \
	asterisk18-chan-local \
	asterisk18-app-record \
	asterisk18-app-senddtmf \
	asterisk18-res-crypto))

$(eval $(call application,pbx-voicemail,LuCI PBX Administration Voicemail Support,luci-app-pbx asterisk18 msmtp coreutils-base64))
$(eval $(call application,ltqtapi,Lantiq voip))
$(eval $(call application,minidlna,LuCI Support for miniDLNA,minidlna))
$(eval $(call application,transmission,LuCI Support for Transmission,transmission-daemon))
$(eval $(call application,watchcat,LuCI Support for Watchcat,watchcat))


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
	DEPENDS:=+luci-base $(4)
  endef

  define Package/luci-theme-$(1)/install
	$(call Package/luci-addons/install/template,$$(1),themes/$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-theme-$(1)),)
    LUCI_SELECTED_MODULES+=themes/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-theme-$(1)
endef


$(eval $(call theme,freifunk-bno,Freifunk Berlin Nordost Theme,\
	Stefan Pirwitz <stefan-at-freifunk-bno-dot-de>))

$(eval $(call theme,freifunk-generic,Freifunk Generic Theme,\
	Manuel Munz <freifunk-at-somakoma-dot-de>))


### Compile ###
PKG_CONFIG_DEPENDS=$(patsubst %,CONFIG_PACKAGE_%,$(LUCI_BUILD_PACKAGES))

include $(INCLUDE_DIR)/package.mk

define Build/Prepare
	@if [ ! -x $(LUCI_TOPDIR)/build/mkrevision.sh ]; then \
		echo "*** Repository layout changed!" >&2; \
		echo "*** Please change the LuCI url in feeds.conf to http://svn.luci.subsignal.org/luci/trunk and reinstall the feed with" >&2; \
		echo "*** ./scripts/feeds update luci; ./scripts/feeds install -a -p luci" >&2; \
		exit 1; \
	fi
	mkdir -p $(PKG_BUILD_DIR)
	$(TAR) c -C $(LUCI_TOPDIR) . \
		--exclude=.pc --exclude=.svn --exclude=.git \
		--exclude='*.o' --exclude='*.so' \
		--exclude=dist | \
			tar x -C $(PKG_BUILD_DIR)/
	$(call Build/Prepare/Default)
endef

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
