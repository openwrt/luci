include $(TOPDIR)/rules.mk

PKG_BRANCH:=trunk
PKG_SOURCE_URL:=https://dev.leipzig.freifunk.net/svn/ff-luci/$(PKG_BRANCH)
PKG_REV:=$(shell LC_ALL=C svn info ${PKG_SOURCE_URL} | sed -ne's/^Last Changed Rev: //p')

PKG_NAME:=ffluci
PKG_VERSION:=0.4+svn$(PKG_REV)
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_SOURCE_PROTO:=svn
PKG_SOURCE_VERSION:=$(PKG_REV)
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)

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
  
  for i in $(PKG_BUILD_DIR)/$(2)/dist/usr/bin/*; do $(INSTALL_BIN) $$i $(1)/usr/bin/; done
  for i in $(PKG_BUILD_DIR)/$(2)/dist/usr/sbin/*; do $(INSTALL_BIN) $$i $(1)/usr/sbin/; done
  for i in $(PKG_BUILD_DIR)/$(2)/dist/bin/*; do $(INSTALL_BIN) $$i $(1)/bin/; done
  for i in $(PKG_BUILD_DIR)/$(2)/dist/sbin/*; do $(INSTALL_BIN) $$i $(1)/sbin/; done
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



### Meta Packages ###

define Package/ffluci-freifunk-meta
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci +ffluci-sgi-haserl +ffluci-freifunk +ffluci-firewall +ffluci-splash
  TITLE:=Freifunk Meta-Package
endef

define Package/ffluci-meta/install
endef


define Package/ffluci-freifunk-halle
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci-freifunk-meta +kmod-tun
  TITLE:=Community Meta-Package Halle
endef

define Package/ffluci-freifunk-halle/install
endef


define Package/ffluci-freifunk-leipzig
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci-freifunk-meta +kmod-tun
  TITLE:=Community Meta-Package Leipzig
endef

define Package/ffluci-freifunk-leipzig/install
  $(call Package/ffluci/install/template,$(1),applications/community-leipzig)
endef



### Modules ###

define Package/ffluci-module-admin-core
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci
  TITLE:=Core Administrative pages for FFLuCI
endef

define Package/ffluci-module-admin-core/install
  $(call Package/ffluci/install/template,$(1),modules/admin-core)
endef


define Package/ffluci-module-freifunk
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci +ffluci-module-admin-core
  TITLE:=Freifunk public and configuration pages
endef

define Package/ffluci-module-freifunk/conffiles
/etc/config/freifunk
endef

define Package/ffluci-module-freifunk/install
  $(call Package/ffluci/install/template,$(1),modules/freifunk)
endef



### Applications ###

define Package/ffluci-firewall
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci +ffluci-module-admin-core
  TITLE:=Firewall and Portforwarding module
endef

define Package/ffluci-firewall/conffiles
/etc/config/luci_fw
endef

define Package/ffluci-firewall/install
  $(call Package/ffluci/install/template,$(1),applications/luci-fw)
endef


define Package/ffluci-splash
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci +ffluci-freifunk +ffluci-sgi-haserl +iptables-mod-nat
  TITLE:=Freifunk DHCP-Splash
endef

define Package/ffluci-splash/conffiles
/etc/config/luci_splash
endef

define Package/ffluci-splash/install
  $(call Package/ffluci/install/template,$(1),applications/luci-splash)
endef



### Server Gateway Interfaces ###

define Package/ffluci-sgi-haserl
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci +haserl-lua
  TITLE:=SGI for Haserl on top of Busybox httpd
endef

define Package/ffluci-sgi-haserl/install
  $(call Package/ffluci/install/template,$(1),applications/sgi-haserl)
endef


define Package/ffluci-sgi-webuci
  $(call Package/ffluci/template)
  DEPENDS:=+ffluci
  TITLE:=SGI for Webuci
endef

define Package/ffluci-sgi-webuci/install
  $(call Package/ffluci/install/template,$(1),applications/sgi-webuci)
endef




$(eval $(call BuildPackage,ffluci))

$(eval $(call BuildPackage,ffluci-freifunk-meta))
$(eval $(call BuildPackage,ffluci-freifunk-halle))
$(eval $(call BuildPackage,ffluci-freifunk-leipzig))

$(eval $(call BuildPackage,ffluci-module-admin-core))
$(eval $(call BuildPackage,ffluci-module-freifunk))

$(eval $(call BuildPackage,ffluci-firewall))
$(eval $(call BuildPackage,ffluci-splash))

$(eval $(call BuildPackage,ffluci-sgi-haserl))
$(eval $(call BuildPackage,ffluci-sgi-webuci))