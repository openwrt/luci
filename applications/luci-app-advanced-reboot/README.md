# luci-app-advanced-reboot

`luci-app-advanced-reboot` is a LuCI (web interface) application for OpenWrt that provides an easy way to reboot your router into an alternative firmware partition (for dual-partition devices) or perform other advanced reboot operations directly from the web UI.

## Features

- Detects supported dual-partition devices.
- Displays current and alternative firmware details.
- Allows rebooting into the alternative partition without using SSH.
- Supports switching between OpenWrt and vendor firmware (if present).

## Installation

You can install this package from the official OpenWrt package repositories or from the Melmac OpenWrt repository:

```sh
opkg update
opkg install luci-app-advanced-reboot
```

## Documentation

Full documentation is available at:  
[https://docs.openwrt.melmac.ca/luci-app-advanced-reboot/](https://docs.openwrt.melmac.ca/luci-app-advanced-reboot/)

## License

This project is licensed under the terms of the GNU General Public License v3.0 (GPL-3.0).
