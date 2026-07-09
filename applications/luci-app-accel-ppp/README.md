# luci-app-accel-ppp

LuCI application for configuring Accel-PPP on OpenWrt.

Maintainer: Abdulkader Alrezej <alrazj.abdulkader@gmail.com>

## Build

Place this package directory under the LuCI feed, for example:

```text
openwrt/luci/applications/luci-app-accel-ppp
```

Then enable:

```text
CONFIG_PACKAGE_accel-ppp=y
CONFIG_PACKAGE_luci-app-accel-ppp=y
```

For a package-only build from the OpenWrt buildroot:

```sh
make package/feeds/luci/luci-app-accel-ppp/compile V=s
```

The LuCI page is installed under:

```text
Services -> Accel-PPP
```
