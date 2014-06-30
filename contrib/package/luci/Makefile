include $(TOPDIR)/rules.mk

LUCI_TOPDIR=../../..

PKG_NAME:=luci
PKG_RELEASE:=1

PKG_BUILD_PARALLEL:=0

PKG_VERSION:=$(shell $(LUCI_TOPDIR)/build/mkrevision.sh 2>/dev/null || echo unknown)

PKG_BUILD_DEPENDS:=$(if $(STAGING_DIR_ROOT),lua/host) iwinfo
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)
PKG_INSTALL_DIR:=$(PKG_BUILD_DIR)/ipkg-install
PKG_USE_MIPS16:=0

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
define Package/luci-base
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=LuCI - Lua Configuration Interface
  URL:=http://luci.subsignal.org/
  MAINTAINER:=LuCI Development Team <luci@lists.subsignal.org>
  SUBMENU:=8. Libraries
  DEPENDS:=+lua +libuci-lua +libubus-lua
  TITLE:=LuCI core libraries
endef

define Package/luci-base/install
	$(call Package/luci/install/template,$(1),modules/base)
	$(PKG_BUILD_DIR)/build/mkversion.sh $(1)/usr/lib/lua/luci/version.lua \
		"OpenWrt Firmware" \
		"$(OPENWRTVERSION)" \
		"trunk" \
		"$(PKG_VERSION)"
endef

define Package/luci-base/config
       choice
               prompt "Build Target"
               default PACKAGE_luci-base_source

       config PACKAGE_luci-base_compile
               bool "Precompiled"

       config PACKAGE_luci-base_stripped
               bool "Stripped"

       config PACKAGE_luci-base_srcdiet
               bool "Compressed Source"

       config PACKAGE_luci-base_source
               bool "Full Source"

       endchoice
endef

define Package/luci-base/conffiles
/etc/config/luci
endef

ifneq ($(CONFIG_PACKAGE_luci-base_compile),)
  LUA_TARGET:=compile
endif

ifneq ($(CONFIG_PACKAGE_luci-base_stripped),)
  LUA_TARGET:=strip
endif

ifneq ($(CONFIG_PACKAGE_luci-base_srcdiet),)
  LUA_TARGET:=diet
endif

ifneq ($(CONFIG_PACKAGE_luci-base),)
  LUCI_SELECTED_MODULES+=modules/base
endif

LUCI_BUILD_PACKAGES += luci-base


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
    $(if $(3),DEPENDS:=+luci-base $(3))
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


$(eval $(call library,httpclient,HTTP(S) client library,+luci-base +luci-lib-nixio))
$(eval $(call library,json,LuCI JSON library))
$(eval $(call library,nixio,NIXIO POSIX library,+PACKAGE_luci-lib-nixio_openssl:libopenssl +PACKAGE_luci-lib-nixio_cyassl:libcyassl))
$(eval $(call library,px5g,RSA/X.509 Key Generator (required for LuCId SSL support),+luci-lib-nixio))
$(eval $(call library,luaneightbl,neightbl - Lua lib for IPv6 neighbors,+luci-base))


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

$(eval $(call protocol,ppp,Support for PPP/PPPoE/PPPoA/PPtP))
$(eval $(call protocol,ipv6,Support for DHCPv6/6in4/6to4/6rd/DS-Lite))
$(eval $(call protocol,3g,Support for 3G,+PACKAGE_luci-proto-3g:comgt))
$(eval $(call protocol,relay,Support for relayd pseudo bridges,+PACKAGE_luci-proto-relay:relayd))


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


$(eval $(call module,admin-mini,LuCI Essentials - stripped down and user-friendly,+luci-base @BROKEN))
$(eval $(call module,admin-full,LuCI Administration - full-featured for full control,+luci-base))
$(eval $(call module,failsafe,LuCI Fail-Safe - Fail-Safe sysupgrade module,+luci-base))
$(eval $(call module,rpc,LuCI RPC - JSON-RPC API,+luci-lib-json))


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


$(eval $(call application,firewall,Firewall and Portforwarding application,\
	+PACKAGE_luci-app-firewall:firewall))

$(eval $(call application,qos,Quality of Service configuration module,\
	+PACKAGE_luci-app-qos:qos-scripts))

$(eval $(call application,commands,LuCI Shell Command Module))


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
  endef

  define Package/luci-theme-$(1)/install
	$(call Package/luci/install/template,$$(1),themes/$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-theme-$(1)),)
    LUCI_SELECTED_MODULES+=themes/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-theme-$(1)
endef

$(eval $(call theme,openwrt,OpenWrt.org))
$(eval $(call theme,bootstrap,Bootstrap Theme (default)))


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
	+uhttpd +uhttpd-mod-ubus +luci-mod-admin-full +luci-theme-bootstrap \
	+luci-app-firewall +luci-proto-ppp +libiwinfo-lua +luci-lib-nixio))

$(eval $(call collection,ssl,\
	Standard OpenWrt set with HTTPS support,\
	+luci +libustream-polarssl +px5g))

$(eval $(call collection,light,\
	Minimum package set using only admin mini and the standard theme,\
	+uhttpd +luci-mod-admin-mini +luci-theme-openwrt @BROKEN))


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
