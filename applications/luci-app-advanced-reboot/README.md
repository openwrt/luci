# Advanced Reboot Web UI (luci-app-advanced-reboot)

## Description

This package allows you to reboot to an alternative partition on the supported (dual-partition) routers and to power off (power down) your OpenWrt device.

## Supported Devices

Currently supported dual-partition devices include:

- Linksys EA3500
- Linksys E4200v2
- Linksys EA4500
- Linksys EA6350v3
- Linksys EA8300
- Linksys EA8500
- Linksys WRT1200AC
- Linksys WRT1900AC
- Linksys WRT1900ACv2
- Linksys WRT1900ACS
- Linksys WRT3200ACM
- Linksys WRT32X
- ZyXEL NBG6817

If your device is not in the list above, however it is a [dual-firmware device](https://openwrt.org/tag/dual_firmware?do=showtag&tag=dual_firmware) and you're interested in having your device supported, please post in [OpenWrt Forum Support Thread](https://forum.openwrt.org/t/web-ui-to-reboot-to-another-partition-dual-partition-routers/3423).

## Screenshot (luci-app-advanced-reboot)

![screenshot](https://raw.githubusercontent.com/stangri/openwrt_packages/master/screenshots/luci-app-advanced-reboot/screenshot02.png "screenshot")

## How to install

Install ```luci-app-advanced-reboot``` from Web UI or connect to your router via ssh and run the following commands:

```sh
opkg update
opkg install luci-app-advanced-reboot
```

If the ```luci-app-advanced-reboot``` package is not found in the official feed/repo for your version of OpenWrt/LEDE Project, you will need to [add a custom repo to your router](https://github.com/stangri/openwrt_packages/blob/master/README.md#on-your-router) first.

## Notes/Known Issues

- When you reboot to a different partition, your current settings (WiFi SSID/password, etc.) will not apply to a different partition. Different partitions might have completely different settings and even firmware.
- If you reboot to a partition which doesn't allow you to switch boot partitions (like stock vendor firmware), you might not be able to boot back to OpenWrt unless you reflash it, losing all the settings.
- Some devices allow you to trigger reboot to an alternative partition by interrupting boot 3 times in a row (by resetting/switching off the device or pulling power). As these methods might be different for different devices, do your own homework.

## Thanks

I'd like to thank everyone who helped create, test and troubleshoot this package. Without help from [@hnyman](https://github.com/hnyman), [@jpstyves](https://github.com/jpstyves), [@imi2003](https://github.com/imi2003), [@jeffsf](https://github.com/jeffsf) and many contributions from [@slh](https://github.com/pkgadd) it wouldn't have been possible.
