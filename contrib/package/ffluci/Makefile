include $(TOPDIR)/rules.mk

PKG_BRANCH:=trunk
PKG_SOURCE_URL:=https://dev.leipzig.freifunk.net/svn/ff-luci/$(PKG_BRANCH)
PKG_REV:=$(shell LC_ALL=C svn info ${PKG_SOURCE_URL} | sed -ne's/^Last Changed Rev: //p')

PKG_NAME:=ffluci
PKG_VERSION:=0.5+svn$(PKG_REV)
PKG_RELEASE:=1

PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_SOURCE_PROTO:=svn
PKG_SOURCE_VERSION:=$(PKG_REV)

PKG_BUILD_DEPENDS:=lua-luci

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install

# LUA_TARGET:=compile LUAC=$(BUILD_DIR_HOST)/lua-luci/luac
LUA_TARGET:=source


include $(INCLUDE_DIR)/package.mk

define Build/Configure
endef

define Build/Compile
	$(MAKE) -C$(PKG_BUILD_DIR) build LUA_TARGET=$(LUA_TARGET)
endef


define Package/ffluci/template
  SECTION:=admin
  CATEGORY:=Administration
  TITLE:=FFLuCI - Freifunk Lua Configuration Interface
  URL:=http://luci.freifunk-halle.net/
  MAINTAINER:=Steven Barth <steven-at-midlink-dot-org>
endef

define Package/ffluci/install/template
	$(CP) $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
endef


define Package/ffluci
  $(call Package/ffluci/template)
  MENU:=1
  DEPENDS:=+lua-luci +luaposix +luci-addons
endef

define Package/ffluci/conffiles
/etc/config/luci
endef

define Package/ffluci/install		
	$(call Package/ffluci/install/template,$(1),core)
	$(call Package/ffluci/install/template,$(1),themes/fledermaus)
endef


### Community Packages ###

define Package/ffluci-ff-halle
  $(call Package/ffluci/template)
  DEPENDS:=ffluci \
   +ffluci-sgi-haserl +ffluci-mod-freifunk +ffluci-app-splash \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice \
   +kmod-tun +ip
  TITLE:=Freifunk Halle Community Meta-Package
endef

define Package/ffluci-ff-halle/install
endef


define Package/ffluci-ff-leipzig
  $(call Package/ffluci/template)
  DEPENDS:=ffluci \
   +ffluci-sgi-haserl +ffluci-mod-freifunk +ffluci-app-splash \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice \
   +kmod-tun +ip
  TITLE:=Freifunk Leipzig Community Meta-Package
endef

define Package/ffluci-ff-leipzig/install
	$(call Package/ffluci/install/template,$(1),applications/community-leipzig)
	$(CP) -a ./ipkg/ffluci-ff-leipzig.postinst $(1)/CONTROL/postinst
endef


define Package/ffluci-ff-hannover
  $(call Package/ffluci/template)
  DEPENDS:=ffluci \
   +ffluci-sgi-haserl +ffluci-mod-freifunk +ffluci-app-splash \
   +olsrd +olsrd-mod-dyn-gw +olsrd-mod-txtinfo +olsrd-mod-nameservice
  TITLE:=Freifunk Hannover Community Meta-Package
  URL:=http://www.freifunk-hannover.de/
  MAINTAINER:=Mickey Knox <mickey-at-netfreaks-dot-org>
endef

define Package/ffluci-ff-hannover/install
	$(call Package/ffluci/install/template,$(1),applications/community-hannover)
	$(CP) -a ./ipkg/ffluci-ff-hannover.postinst $(1)/CONTROL/postinst
endef


### Modules ###

define Package/ffluci-mod-admin-core
  $(call Package/ffluci/template)
  DEPENDS:=ffluci
  TITLE:=Core administrative pages
endef

define Package/ffluci-mod-admin-core/install
	$(call Package/ffluci/install/template,$(1),modules/admin-core)
endef


define Package/ffluci-mod-freifunk
  $(call Package/ffluci/template)
  DEPENDS:=ffluci +ffluci-mod-admin-core +ffluci-app-firewall
  TITLE:=Freifunk public and administrative pages
endef

define Package/ffluci-mod-freifunk/conffiles
/etc/config/freifunk
endef

define Package/ffluci-mod-freifunk/install
	$(call Package/ffluci/install/template,$(1),modules/freifunk)
endef



### Applications ###

define Package/ffluci-app-firewall
  $(call Package/ffluci/template)
  DEPENDS:=ffluci +ffluci-mod-admin-core
  TITLE:=Firewall and Portforwarding application
endef

define Package/ffluci-app-firewall/conffiles
/etc/config/luci_fw
endef

define Package/ffluci-app-firewall/install
	$(call Package/ffluci/install/template,$(1),applications/luci-fw)
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-fw/dist/etc/init.d/luci_fw $(1)/etc/init.d
endef


define Package/ffluci-app-splash
  $(call Package/ffluci/template)
  DEPENDS:=ffluci +ffluci-mod-freifunk +ffluci-sgi-haserl +iptables-mod-nat +iptables-mod-ipopt
  TITLE:=Freifunk DHCP-Splash application
endef

define Package/ffluci-app-splash/conffiles
/etc/config/luci_splash
endef

define Package/ffluci-app-splash/install
	$(call Package/ffluci/install/template,$(1),applications/luci-splash)
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/usr/sbin/luci-splash $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/etc/init.d/luci_splash $(1)/etc/init.d
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/etc/cron.minutely/luci_splash $(1)/etc/cron.minutely
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/usr/lib/luci-splash/htdocs/cgi-bin/index.cgi $(1)/usr/lib/luci-splash/htdocs/cgi-bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/applications/luci-splash/dist/www/cgi-bin/luci-splash $(1)/www/cgi-bin/luci-splash
endef



### Server Gateway Interfaces ###

define Package/ffluci-sgi-haserl
  $(call Package/ffluci/template)
  DEPENDS:=ffluci +haserl-lua
  TITLE:=SGI for Haserl
endef

define Package/ffluci-sgi-haserl/install
	$(call Package/ffluci/install/template,$(1),applications/sgi-haserl)
	$(CP) -a ./ipkg/ffluci-sgi-haserl.postinst $(1)/CONTROL/postinst
endef


define Package/ffluci-sgi-webuci
  $(call Package/ffluci/template)
  DEPENDS:=ffluci
  TITLE:=SGI for Webuci
endef

define Package/ffluci-sgi-webuci/install
	$(call Package/ffluci/install/template,$(1),applications/sgi-webuci)
endef




$(eval $(call BuildPackage,ffluci))

$(eval $(call BuildPackage,ffluci-ff-halle))
$(eval $(call BuildPackage,ffluci-ff-leipzig))
$(eval $(call BuildPackage,ffluci-ff-hannover))

$(eval $(call BuildPackage,ffluci-mod-admin-core))
$(eval $(call BuildPackage,ffluci-mod-freifunk))

$(eval $(call BuildPackage,ffluci-app-firewall))
$(eval $(call BuildPackage,ffluci-app-splash))

$(eval $(call BuildPackage,ffluci-sgi-haserl))
$(eval $(call BuildPackage,ffluci-sgi-webuci))
