include $(TOPDIR)/rules.mk

PKG_BRANCH:=trunk
PKG_SOURCE_URL:=https://dev.leipzig.freifunk.net/svn/ff-luci/$(PKG_BRANCH)
PKG_REV:=$(shell LC_ALL=C svn info ${PKG_SOURCE_URL} | sed -ne's/^Last Changed Rev: //p')

PKG_NAME:=luci
PKG_VERSION:=0.5+svn$(PKG_REV)
PKG_RELEASE:=1

PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_SOURCE_PROTO:=svn
PKG_SOURCE_VERSION:=$(PKG_REV)

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

LUA_TARGET:=source
PKG_SELECTED_MODULES:=


include $(INCLUDE_DIR)/package.mk

define Build/Configure
endef


define Build/Compile 
	for i in $(PKG_SELECTED_MODULES); do $(MAKE) -C$(PKG_BUILD_DIR)/$$$$i build LUA_TARGET=$(LUA_TARGET); done
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
  SUBMENU:=LuCI - Freifunk Support
  DEPENDS:=+luci-mod-freifunk
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
	$(CP) $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
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


define Package/luci-web
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-addons
  TITLE:=MVC Webframework
endef

define Package/luci-web/conffiles
/etc/config/luci
endef

define Package/luci-web/install
	$(call Package/luci/install/template,$(1),libs/web)
endef



### Community Packages ###

define Package/luci-ff-halle
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-sgi-haserl +luci-app-splash \
   +luci-app-ffwizard-leipzig \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice \
   +kmod-tun +ip
  TITLE:=Freifunk Halle Community Meta-Package
endef

define Package/luci-ff-halle/install
	$(call Package/luci/install/template,$(1),applications/community-halle)
	$(CP) -a ./ipkg/luci-ff-halle.postinst $(1)/CONTROL/postinst
endef


define Package/luci-ff-leipzig
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-sgi-haserl +luci-app-splash \
   +luci-app-ffwizard-leipzig \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice \
   +kmod-tun +ip
  TITLE:=Freifunk Leipzig Community Meta-Package
endef

define Package/luci-ff-leipzig/install
	$(call Package/luci/install/template,$(1),applications/community-leipzig)
	$(CP) -a ./ipkg/luci-ff-leipzig.postinst $(1)/CONTROL/postinst
endef


define Package/luci-ff-hannover
  $(call Package/luci/fftemplate)
  DEPENDS+= \
   +luci-sgi-haserl +luci-app-splash \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice
  TITLE:=Freifunk Hannover Community Meta-Package
  URL:=http://www.freifunk-hannover.de/
  MAINTAINER:=Mickey Knox <mickey-at-netfreaks-dot-org>
endef

define Package/luci-ff-hannover/install
	$(call Package/luci/install/template,$(1),applications/community-hannover)
	$(CP) -a ./ipkg/luci-ff-hannover.postinst $(1)/CONTROL/postinst
endef


### Modules ###

define Package/luci-mod-admin-core
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-web +luci-cbi +luci-theme-fledermaus
  TITLE:=Administration module
endef

define Package/luci-mod-admin-core/install
	$(call Package/luci/install/template,$(1),modules/admin-core)
endef


define Package/luci-mod-freifunk
  $(call Package/luci/fftemplate)
  DEPENDS:=+luci-mod-admin-core
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
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-fw/dist/etc/init.d/luci_fw $(1)/etc/init.d
endef


define Package/luci-app-splash
  $(call Package/luci/fftemplate)
  DEPENDS+=+luci-sgi-haserl +iptables-mod-nat +iptables-mod-ipopt
  TITLE:=Freifunk DHCP-Splash application
endef

define Package/luci-app-splash/conffiles
/etc/config/luci_splash
endef

define Package/luci-app-splash/install
	$(call Package/luci/install/template,$(1),applications/luci-splash)
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/usr/sbin/luci-splash $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/etc/init.d/luci_splash $(1)/etc/init.d
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/etc/cron.minutely/luci_splash $(1)/etc/cron.minutely
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/usr/lib/luci-splash/htdocs/cgi-bin/index.cgi $(1)/usr/lib/luci-splash/htdocs/cgi-bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/www/cgi-bin/luci-splash $(1)/www/cgi-bin/luci-splash
endef


define Package/luci-app-statistics
  $(call Package/luci/webtemplate)
  DEPENDS+=+luci-mod-admin-core +collectd +collectd-mod-rrdtool1 +rrdtool1
  TITLE:=LuCI Statistics Application (incomplete)
endef

define Package/luci-app-statistics/conffiles
/etc/config/luci_statistics
endef

define Package/luci-app-statistics/install
	$(call Package/luci/install/template,$(1),applications/luci-statistics)
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-statistics/dist/usr/bin/stat-genconfig $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-statistics/dist/etc/init.d/luci_statistics $(1)/etc/init.d
endef


### Server Gateway Interfaces ###

define Package/luci-sgi-haserl
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-web +haserl-lua
  TITLE:=SGI for Haserl
endef

define Package/luci-sgi-haserl/install
	$(call Package/luci/install/template,$(1),libs/sgi-haserl)
	$(CP) -a ./ipkg/luci-sgi-haserl.postinst $(1)/CONTROL/postinst
endef


define Package/luci-sgi-webuci
  $(call Package/luci/libtemplate)
  DEPENDS+=+luci-web
  TITLE:=SGI for Webuci
endef

define Package/luci-sgi-webuci/install
	$(call Package/luci/install/template,$(1),libs/sgi-webuci)
endef

### Templates ###
define Package/luci-theme-fledermaus
  $(call Package/luci/thtemplate)
  TITLE:=Fledermaus (default)
endef

define Package/luci-theme-fledermaus/install
	$(call Package/luci/install/template,$(1),themes/fledermaus)
endef


### Compile ###
ifneq ($(CONFIG_PACKAGE_luci-core),)
	PKG_SELECTED_MODULES+=libs/core
endif
ifneq ($(CONFIG_PACKAGE_luci-cbi),)
	PKG_SELECTED_MODULES+=libs/cbi
endif
ifneq ($(CONFIG_PACKAGE_luci-web),)
	PKG_SELECTED_MODULES+=libs/web
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

ifneq ($(CONFIG_PACKAGE_luci-mod-admin-core),)
	PKG_SELECTED_MODULES+=modules/admin-core
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
ifneq ($(CONFIG_PACKAGE_luci-app-splash),)
	PKG_SELECTED_MODULES+=applications/luci-splash
endif
ifneq ($(CONFIG_PACKAGE_luci-app-statistics),)
	PKG_SELECTED_MODULES+=applications/luci-statistics
endif

ifneq ($(CONFIG_PACKAGE_luci-sgi-haserl),)
	PKG_SELECTED_MODULES+=libs/sgi-haserl
endif
ifneq ($(CONFIG_PACKAGE_luci-sgi-webuci),)
	PKG_SELECTED_MODULES+=libs/sgi-webuci
endif

ifneq ($(CONFIG_PACKAGE_luci-theme-fledermaus),)
	PKG_SELECTED_MODULES+=themes/fledermaus
endif


$(eval $(call BuildPackage,luci-core))
$(eval $(call BuildPackage,luci-cbi))
$(eval $(call BuildPackage,luci-web))

$(eval $(call BuildPackage,luci-ff-halle))
$(eval $(call BuildPackage,luci-ff-leipzig))
$(eval $(call BuildPackage,luci-ff-hannover))

$(eval $(call BuildPackage,luci-mod-admin-core))
$(eval $(call BuildPackage,luci-mod-freifunk))

$(eval $(call BuildPackage,luci-app-ffwizard-leipzig))
$(eval $(call BuildPackage,luci-app-firewall))
$(eval $(call BuildPackage,luci-app-splash))
$(eval $(call BuildPackage,luci-app-statistics))

$(eval $(call BuildPackage,luci-sgi-haserl))
$(eval $(call BuildPackage,luci-sgi-webuci))

$(eval $(call BuildPackage,luci-theme-fledermaus))
