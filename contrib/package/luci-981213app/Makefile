include $(TOPDIR)/rules.mk

LUCI_TOPDIR=../../..

PKG_NAME:=luci-981213app
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
define Package/luci-981213app/install/template
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/dist/* $(1)/ -R
	$(CP) -a $(PKG_BUILD_DIR)/$(2)/ipkg/* $(1)/CONTROL/ 2>/dev/null || true
endef



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
	$(call Package/luci-981213app/install/template,$$(1),applications/luci-$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-app-$(1)),)
    LUCI_SELECTED_MODULES+=applications/luci-$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-app-$(1)
endef
$(eval $(call application,macvlan,LuCI Support for macvlan,\
	kmod-macvlan luci-app-mwan3))
$(eval $(call application,vsftpd,FTP Server,\
	vsftpd-pam))
$(eval $(call application,shadowsocks,LuCI Support for shadowsocks,\
	shadowsocks-libev))



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
	$(call Package/luci-981213app/install/template,$$(1),themes/$(1))
  endef

  ifneq ($(CONFIG_PACKAGE_luci-theme-$(1)),)
    LUCI_SELECTED_MODULES+=themes/$(1)
  endif

  LUCI_BUILD_PACKAGES += luci-theme-$(1)
endef




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
