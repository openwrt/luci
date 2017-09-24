# Advanced Reboot Web UI (luci-app-advanced-reboot)

## Description
This package allows you to reboot to an alternative partition on supported (dual-partition) routers and to power off (power down) your OpenWrt/LEDE Project device.

## Supported Devices
Currently supported dual-partition devices include:
- Linksys WRT1200AC
- Linksys WRT1900AC
- Linksys WRT1900ACv2
- Linksys WRT1900ACS
- Linksys WRT3200ACM
- Linksys E4200v2
- Linksys EA4500
- Linksys EA8500

If you're interested in having your device supported, please post in [LEDE Project Forum Support Thread](https://forum.lede-project.org/t/web-ui-to-reboot-to-another-partition-dual-partition-routers/3423).

## Screenshot (luci-app-advanced-reboot)
![screenshot](https://raw.githubusercontent.com/stangri/screenshots/master/luci-app-advanced-reboot/screenshot01.png "screenshot")

## How to install
Install ```luci-app-advanced-reboot``` from Web UI or connect to your router via ssh and run the following commands:
```sh
opkg update
opkg install luci-app-advanced-reboot
```

## Notes/Known Issues
- When you reboot to a different partition, your current settings (WiFi SSID/password, etc.) will not apply to a different partition. Different partitions might have completely different settings and even firmware.
- If you reboot to a partition which doesn't allow you to switch boot partitions (like stock Linksys firmware), you might not be able to boot back to OpenWrt/LEDE Project unless you reflash it, loosing all the settings.
- Some devices allow you to trigger reboot to alternative partition by interrupting boot 3 times in a row (by resetting/switching off the device or pulling power). As these methods might be different for different devices, do your own homework.

## Thanks
I'd like to thank everyone who helped create, test and troubleshoot this package. Without contributions from [@hnyman](https://github.com/hnyman) and [@jpstyves](https://github.com/jpstyves) it wouldn't have been possible.
