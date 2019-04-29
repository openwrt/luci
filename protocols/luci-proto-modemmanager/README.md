# luci-proto-modemmanager
This luci-protocol adds support to set up and configure basic options for a modem using [ModemManager](https://gitlab.freedesktop.org/mobile-broadband/mobile-broadband-openwrt) and LuCI on OpenWrt.  Requires ModemManager.  Assumes a modem is installed and working.

## Features
* Automatically detects the modem
* Offers several APN's to choose from, users can add more
* Works with the default OpenWrt BusyBox configuration

![Screen Shot 2018-10-30 at 11.13.54 am.jpg](https://bitbucket.org/repo/Egdr7gE/images/1662368197-Screen%20Shot%202018-10-30%20at%2011.13.54%20am.jpg)


## Requirements
* ModemManager installed and running
* `grep` (included in BusyBox by default)
* `tr` (included in BusyBox by default)

## Install
1. download the code
1. place it under your LuCI `protocols` directory
1. run `./scripts/feeds update -a && ./scripts/feeds install luci-proto-modemmanager` from your OpenWrt root directory
1. enable in `menuconfig`


## Download:
```
$ git clone https://github.com/nickberry17/luci-proto-modemmanager.git
```

## Issues
If you come across a bug or have an enhancement I invite you to [open an issue](https://github.com/nickberry17/luci-proto-modemmanager/issues/new).
