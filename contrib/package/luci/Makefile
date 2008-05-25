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

# LUA_TARGET:=compile LUAC=$(BUILD_DIR_HOST)/lua/luac
LUA_TARGET:=source


include $(INCLUDE_DIR)/package.mk

define Build/Configure
endef

define Build/Compile
	$(MAKE) -C$(PKG_BUILD_DIR) build LUA_TARGET=$(LUA_TARGET)
endef


define Package/luci/template
  SECTION:=admin
  CATEGORY:=Administration
  TITLE:=LuCI - Lua Configuration Interface
  URL:=http://luci.freifunk-halle.net/
  MAINTAINER:=Steven Barth <steven-at-midlink-dot-org>
endef

define Package/luci/install/template
	$(CP) $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
endef


define Package/luci
  $(call Package/luci/template)
  MENU:=1
  DEPENDS:=+lua +luaposix +luci-addons
endef

define Package/luci/conffiles
/etc/config/luci
endef

define Package/luci/install		
	$(call Package/luci/install/template,$(1),core)
	$(call Package/luci/install/template,$(1),themes/fledermaus)
endef


### Community Packages ###

define Package/luci-ff-halle
  $(call Package/luci/template)
  DEPENDS:=luci \
   +luci-sgi-haserl +luci-mod-freifunk +luci-app-splash \
   +luci-app-ffwizard-leipzig \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice \
   +kmod-tun +ip
  TITLE:=Freifunk Halle Community Meta-Package
endef

define Package/luci-ff-halle/install
endef


define Package/luci-ff-leipzig
  $(call Package/luci/template)
  DEPENDS:=luci \
   +luci-sgi-haserl +luci-mod-freifunk +luci-app-splash \
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
  $(call Package/luci/template)
  DEPENDS:=luci \
   +luci-sgi-haserl +luci-mod-freifunk +luci-app-splash \
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
  $(call Package/luci/template)
  DEPENDS:=luci
  TITLE:=Core administrative pages
endef

define Package/luci-mod-admin-core/install
	$(call Package/luci/install/template,$(1),modules/admin-core)
endef


define Package/luci-mod-freifunk
  $(call Package/luci/template)
  DEPENDS:=luci +luci-mod-admin-core +luci-app-firewall
  TITLE:=Freifunk public and administrative pages
endef

define Package/luci-mod-freifunk/conffiles
/etc/config/freifunk
endef

define Package/luci-mod-freifunk/install
	$(call Package/luci/install/template,$(1),modules/freifunk)
endef



### Applications ###

define Package/luci-app-ffwizard-leipzig
  $(call Package/luci/template)
  DEPENDS:=luci +luci-mod-freifunk
  TITLE:=Freifunk Leipzig configuration wizard
endef

define Package/luci-app-ffwizard-leipzig/install
	$(call Package/luci/install/template,$(1),applications/luci-ffwizard-leipzig)
endef


define Package/luci-app-firewall
  $(call Package/luci/template)
  DEPENDS:=luci +luci-mod-admin-core
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
  $(call Package/luci/template)
  DEPENDS:=luci +luci-mod-freifunk +luci-sgi-haserl +iptables-mod-nat +iptables-mod-ipopt
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
  $(call Package/luci/template)
  DEPENDS:=luci +collectd +collectd-mod-rrdtool1 +rrdtool1
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
  $(call Package/luci/template)
  DEPENDS:=luci +haserl-lua
  TITLE:=SGI for Haserl
endef

define Package/luci-sgi-haserl/install
	$(call Package/luci/install/template,$(1),applications/sgi-haserl)
	$(CP) -a ./ipkg/luci-sgi-haserl.postinst $(1)/CONTROL/postinst
endef


define Package/luci-sgi-webuci
  $(call Package/luci/template)
  DEPENDS:=luci
  TITLE:=SGI for Webuci
endef

define Package/luci-sgi-webuci/install
	$(call Package/luci/install/template,$(1),applications/sgi-webuci)
endef




$(eval $(call BuildPackage,luci))

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
