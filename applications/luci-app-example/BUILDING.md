# Building a LuCI package

Essentially, you follow the [build system](https://openwrt.org/docs/guide-developer/toolchain/use-buildsystem) instructions: 
1. Fetch the OpenWrt repository.
2. Update the `feeds.conf.default` to point `luci` at a local directory
3. Build out the full toolchain
4. Then follow the instructions for a [single package](https://openwrt.org/docs/guide-developer/toolchain/single.package) to build the `.opkg` file for the example app.

Wiki documentation overrides this file.

## Setup

* Create a working directory, like `~/src`
* Clone the OpenWrt repository into `~/src/openwrt`
* Clone the LuCI repository into `~/src/luci`

From here on you'll be working in `~/src/openwrt`

## Remapping LuCI source to local disk

* Edit `~/src/openwrt/feeds.conf.default` and comment out the `src-git luci` entry
* Add a `src-link luci` entry pointing to your luci checkout - for example `src-link luci /home/myuser/src/luci`
* Use the `scripts/feeds` tool per the [documentation](https://openwrt.org/docs/guide-developer/toolchain/use-buildsystem#updating_feeds) to update and install all feeds; you should see the local directory get used for luci

If you're doing a whole new application, instead of editing this one, you can use the `src-link custom` example instead as a basis, leaving `src-git luci` alone.

## Selecting the app

* Run `make menuconfig`
* Change the Target system to match your test environment (x86 for QEMU for instance)
* Select the LuCI option
* Select the Applications option
* Navigate the list to find `luci-app-example`
* Press `m` to make the selection be `<M>` - modular build
* Choose Exit all the way back out, and save the configuration

## Toolchain build

Even though you're only building a simple JS + Lua package, you'll need the whole toolchain.
Though the command says "install", nothing is actually installed outside of the working directory (`~/src/openwrt` in this case).

* Run `make tools/install`
* Run `make toolchain/install`

## Package build

This will trigger the build of all the dependencies, such as **ubus**, **libjson-c**, **rpcd** etcetera.

* Run `make package/luci-app-example/compile`

The IPK file will be produced in `bin/packages/<architecture>/luci/`. This file can be copied to your test environment (QEMU, real hardware etcetera), and installed with `opkg`.

