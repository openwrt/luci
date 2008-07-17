include $(TOPDIR)/rules.mk

PKG_BRANCH:=trunk

ifeq ($(DUMP),)
  USELOCAL:=$(shell grep luci ../../../.project 2>/dev/null >/dev/null && echo 1)
endif

PKG_NAME:=luci
PKG_RELEASE:=1

ifeq ($(USELOCAL),1)
  PKG_VERSION:=0.7+svn
else
  PKG_SOURCE_URL:=https://dev.leipzig.freifunk.net/svn/ff-luci/$(PKG_BRANCH)
  ifeq ($(DUMP),)
    PKG_REV:=$(shell LC_ALL=C svn info ${PKG_SOURCE_URL} | sed -ne's/^Last Changed Rev: //p')
    PKG_VERSION:=0.7+svn$(PKG_REV)
  endif
  PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
  PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
  PKG_SOURCE_PROTO:=svn
  PKG_SOURCE_VERSION:=$(PKG_REV)
endif

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

PKG_BUILD_DEPENDS:=libnotimpl
LUA_TARGET:=source
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
  SUBMENU:=LuCI - Libraries
  DEPENDS:=+luci-core
endef

define Package/luci/fftemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI - Freifunk Support (GERMAN ONLY)
  DEPENDS:=+luci-mod-freifunk
endef

define Package/luci/httpdtemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI - Non-Forking HTTP-Daemon (EXPERIMENTAL)
  DEPENDS:=+luci-httpd
endef

define Package/luci/i18ntemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI - Translations
  DEPENDS:=+luci-web
endef

define Package/luci/thtemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI - Themes
  DEPENDS:=+luci-web
endef

define Package/luci/webtemplate
  $(call Package/luci/libtemplate)
  SUBMENU:=LuCI - Webinterface Components
endef


define Package/luci/install/template
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/ipkg/* $(1)/CONTROL/ 2>/dev/null || true
endef



### Core package ###

define Package/luci-core
  $(call Package/luci/libtemplate)
  DEPENDS:=+lua +luaposix
  TITLE:=LuCI core libraries
endef

define Package/luci-core/install		
	$(call Package/luci/install/template,$(1),libs/core)
endef

define Package/luci-core/config
       choice
               prompt "Build Target"
               default PACKAGE_luci-core_compile

       config PACKAGE_luci-core_compile
               bool "Production"

       config PACKAGE_luci-core_source
               bool "Debug"

       endchoice
endef

ifneq ($(CONFIG_PACKAGE_luci-core_compile),)
  LUA_TARGET:=compile
endif


### Libraries ###
define Package/luci-cbi
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-web
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


define Package/luci-web
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-http +luci-addons +luci-uci +luci-sgi-cgi
  TITLE:=MVC Webframework
endef

define Package/luci-web/conffiles
/etc/config/luci
endef

define Package/luci-web/install
	$(call Package/luci/install/template,$(1),libs/web)
endef



### HTTPD ###

define Package/luci-httpd
  $(call Package/luci/httpdtemplate)
  DEPENDS:=+luci-http +luasocket
  TITLE:=Server Core
endef

define Package/luci-httpd/install
	$(call Package/luci/install/template,$(1),libs/httpd)
endef



### Community Packages ###

define Package/luci-ff-halle
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-sgi-cgi +luci-app-splash +luci-app-olsr \
   +luci-app-ffwizard-leipzig \
   +luci-theme-fledermaus \
   +luci-i18n-german \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice \
   +kmod-tun +ip
  TITLE:=Freifunk Halle Community Meta-Package
endef

define Package/luci-ff-halle/install
	$(call Package/luci/install/template,$(1),applications/community-halle)
endef


define Package/luci-ff-leipzig
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-sgi-cgi +luci-app-splash +luci-app-olsr \
   +luci-app-ffwizard-leipzig \
   +luci-theme-fledermaus \
   +luci-i18n-german \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice \
   +kmod-tun +ip
  TITLE:=Freifunk Leipzig Community Meta-Package
endef

define Package/luci-ff-leipzig/install
	$(call Package/luci/install/template,$(1),applications/community-leipzig)
endef


define Package/luci-ff-hannover
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-sgi-cgi +luci-app-splash +luci-app-olsr \
   +luci-theme-fledermaus \
   +luci-i18n-german \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice
  TITLE:=Freifunk Hannover Community Meta-Package
  URL:=http://www.freifunk-hannover.de/
  MAINTAINER:=Mickey Knox <mickey-at-netfreaks-dot-org>
endef

define Package/luci-ff-hannover/install
	$(call Package/luci/install/template,$(1),applications/community-hannover)
endef


define Package/luci-ff-berlin
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-sgi-cgi +luci-app-splash +luci-app-olsr \
   +luci-theme-fledermaus \
   +luci-i18n-german \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice
  TITLE:=Freifunk Berlin Community Meta-Package
endef

define Package/luci-ff-berlin/install
	$(call Package/luci/install/template,$(1),applications/community-berlin)
endef

define Package/luci-ff-augsburg
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-sgi-cgi +luci-app-splash +luci-app-olsr \
   +luci-theme-fledermaus \
   +luci-i18n-german \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice
  TITLE:=Freifunk Augsburg Community Meta-Package
endef

define Package/luci-ff-augsburg/install
        $(call Package/luci/install/template,$(1),applications/community-augsburg)
endef

### Modules ###

define Package/luci-mod-admin-core
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-web +luci-cbi +luci-theme-openwrt +luci-i18n-english
  TITLE:=Administration core module
endef

define Package/luci-mod-admin-core/install
	$(call Package/luci/install/template,$(1),modules/admin-core)
endef


define Package/luci-mod-admin-mini
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-mod-admin-core
  TITLE:=Simplified Administration module (INCOMPLETE)
endef

define Package/luci-mod-admin-mini/install
	$(call Package/luci/install/template,$(1),modules/admin-mini)
endef


define Package/luci-mod-admin-full
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-mod-admin-core
  TITLE:=Full featured Administration module
endef

define Package/luci-mod-admin-full/install
	$(call Package/luci/install/template,$(1),modules/admin-full)
endef


define Package/luci-mod-freifunk
  $(call Package/luci/fftemplate)
  DEPENDS:=+luci-mod-admin-full
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
  DEPENDS+=+luci-app-firewall
  TITLE:=Freifunk Leipzig configuration wizard
endef

define Package/luci-app-ffwizard-leipzig/install
	$(call Package/luci/install/template,$(1),applications/luci-ffwizard-leipzig)
endef


define Package/luci-app-firewall
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-mod-admin-core
  TITLE:=Firewall and Portforwarding application
endef

define Package/luci-app-firewall/conffiles
/etc/config/luci_fw
endef

define Package/luci-app-firewall/install
	$(call Package/luci/install/template,$(1),applications/luci-fw)
endef


define Package/luci-app-olsr
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-mod-admin-full +olsrd-mod-txtinfo
  TITLE:=OLSR configuration and status module
endef

define Package/luci-app-olsr/install
	$(call Package/luci/install/template,$(1),applications/luci-olsr)
endef


define Package/luci-app-qos
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-mod-admin-core +qos-scripts
  TITLE:=Quality of Service configuration module
endef

define Package/luci-app-qos/install
	$(call Package/luci/install/template,$(1),applications/luci-qos)
endef


define Package/luci-app-splash
  $(call Package/luci/fftemplate)
  DEPENDS+=+luasocket +iptables-mod-nat +iptables-mod-ipopt
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
  DEPENDS+=+luci-mod-admin-full +collectd +collectd-mod-rrdtool1 +rrdtool1
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
  DEPENDS+=+luci-mod-admin-core +miniupnpd
  TITLE:=Universal Plug & Play configuration module
endef

define Package/luci-app-upnp/install
	$(call Package/luci/install/template,$(1),applications/luci-upnp)
endef


### Server Gateway Interfaces ###

define Package/luci-sgi-cgi
  $(call Package/luci/libtemplate)
  TITLE:=SGI for CGI
endef

define Package/luci-sgi-cgi/install
	$(call Package/luci/install/template,$(1),libs/sgi-cgi)
endef

define Package/luci-sgi-luci
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-httpd
  TITLE:=SGI for LuCI HTTPD
endef

define Package/luci-sgi-luci/install
	$(call Package/luci/install/template,$(1),libs/sgi-luci)
endef

define Package/luci-sgi-webuci
  $(call Package/luci/libtemplate)
  TITLE:=SGI for Webuci
endef

define Package/luci-sgi-webuci/install
	$(call Package/luci/install/template,$(1),libs/sgi-webuci)
endef

### Themes ###
define Package/luci-theme-fledermaus
  $(call Package/luci/fftemplate)
  DEPENDS:=+luci-web
  TITLE:=Fledermaus Theme
endef

define Package/luci-theme-fledermaus/install
	$(call Package/luci/install/template,$(1),themes/fledermaus)
endef

define Package/luci-theme-openwrt
  $(call Package/luci/thtemplate)
  TITLE:=OpenWRT.org (default)
endef

define Package/luci-theme-openwrt/install
	$(call Package/luci/install/template,$(1),themes/openwrt.org)
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
  TITLE:=French
endef

define Package/luci-i18n-french/install
	$(call Package/luci/install/template,$(1),i18n/french)
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
ifneq ($(CONFIG_PACKAGE_luci-uci),)
	PKG_SELECTED_MODULES+=libs/uci
endif
ifneq ($(CONFIG_PACKAGE_luci-web),)
	PKG_SELECTED_MODULES+=libs/web
endif

ifneq ($(CONFIG_PACKAGE_luci-httpd),)
	PKG_SELECTED_MODULES+=libs/httpd
endif

ifneq ($(CONFIG_PACKAGE_luci-ff-halle),)
	PKG_SELECTED_MODULES+=applications/community-halle
endif
ifneq ($(CONFIG_PACKAGE_luci-ff-leipzig),)
	PKG_SELECTED_MODULES+=applications/community-leipzig
endif
ifneq ($(CONFIG_PACKAGE_luci-ff-hannover),)
	PKG_SELECTED_MODULES+=applications/community-hannover
endif
ifneq ($(CONFIG_PACKAGE_luci-ff-berlin),)
	PKG_SELECTED_MODULES+=applications/community-berlin
endif
ifneq ($(CONFIG_PACKAGE_luci-ff-augsburg),)
        PKG_SELECTED_MODULES+=applications/community-augsburg
endif

ifneq ($(CONFIG_PACKAGE_luci-mod-admin-core),)
	PKG_SELECTED_MODULES+=modules/admin-core
endif
ifneq ($(CONFIG_PACKAGE_luci-mod-admin-mini),)
	PKG_SELECTED_MODULES+=modules/admin-mini
endif
ifneq ($(CONFIG_PACKAGE_luci-mod-admin-full),)
	PKG_SELECTED_MODULES+=modules/admin-full
endif
ifneq ($(CONFIG_PACKAGE_luci-mod-freifunk),)
	PKG_SELECTED_MODULES+=modules/freifunk
endif

ifneq ($(CONFIG_PACKAGE_luci-app-ffwizard-leipzig),)
	PKG_SELECTED_MODULES+=applications/luci-ffwizard-leipzig
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

ifneq ($(CONFIG_PACKAGE_luci-sgi-cgi),)
	PKG_SELECTED_MODULES+=libs/sgi-cgi
endif
ifneq ($(CONFIG_PACKAGE_luci-sgi-luci),)
	PKG_SELECTED_MODULES+=libs/sgi-luci
endif
ifneq ($(CONFIG_PACKAGE_luci-sgi-webuci),)
	PKG_SELECTED_MODULES+=libs/sgi-webuci
endif

ifneq ($(CONFIG_PACKAGE_luci-theme-fledermaus),)
	PKG_SELECTED_MODULES+=themes/fledermaus
endif
ifneq ($(CONFIG_PACKAGE_luci-theme-openwrt),)
	PKG_SELECTED_MODULES+=themes/openwrt.org
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


MAKE_FLAGS += \
	MODULES="$(PKG_SELECTED_MODULES)" \
	LUA_TARGET="$(LUA_TARGET)" \
	LUA_SHLIBS="-llua -lm" \
	CFLAGS="$(TARGET_CFLAGS) -I$(STAGING_DIR)/usr/include" \
	LDFLAGS="$(TARGET_LDFLAGS) -L$(STAGING_DIR)/usr/lib" \
	OS="Linux"


$(eval $(call BuildPackage,luci-core))
$(eval $(call BuildPackage,luci-cbi))
$(eval $(call BuildPackage,luci-fastindex))
$(eval $(call BuildPackage,luci-http))
$(eval $(call BuildPackage,luci-uci))
$(eval $(call BuildPackage,luci-web))

$(eval $(call BuildPackage,luci-httpd))

$(eval $(call BuildPackage,luci-ff-halle))
$(eval $(call BuildPackage,luci-ff-leipzig))
$(eval $(call BuildPackage,luci-ff-hannover))
$(eval $(call BuildPackage,luci-ff-berlin))
$(eval $(call BuildPackage,luci-ff-augsburg))

$(eval $(call BuildPackage,luci-mod-admin-core))
$(eval $(call BuildPackage,luci-mod-admin-mini))
$(eval $(call BuildPackage,luci-mod-admin-full))
$(eval $(call BuildPackage,luci-mod-freifunk))

$(eval $(call BuildPackage,luci-app-ffwizard-leipzig))
$(eval $(call BuildPackage,luci-app-firewall))
$(eval $(call BuildPackage,luci-app-olsr))
$(eval $(call BuildPackage,luci-app-qos))
$(eval $(call BuildPackage,luci-app-splash))
$(eval $(call BuildPackage,luci-app-statistics))
$(eval $(call BuildPackage,luci-app-upnp))

$(eval $(call BuildPackage,luci-sgi-cgi))
$(eval $(call BuildPackage,luci-sgi-luci))
$(eval $(call BuildPackage,luci-sgi-webuci))

$(eval $(call BuildPackage,luci-theme-fledermaus))
$(eval $(call BuildPackage,luci-theme-openwrt))

$(eval $(call BuildPackage,luci-i18n-german))
$(eval $(call BuildPackage,luci-i18n-english))
$(eval $(call BuildPackage,luci-i18n-french))
