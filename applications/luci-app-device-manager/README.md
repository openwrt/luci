# luci-app-device-manager

轻量级 OpenWrt LuCI 局域网设备管理插件，可按 MAC 地址保存名称、备注、分组和设备类型。已有自定义数据在升级时保留。

A lightweight LAN device manager for OpenWrt LuCI. Combine host hints, DHCP
leases, Wi-Fi associations and kernel neighbors; save names, remarks, groups
and manual device types by MAC address, including saved offline devices.

## 功能 / Features

- 展示 IPv4、IPv6、接口和状态依据，区分在线、离线和未知状态。
- 按分组、状态和关键词筛选，支持排序、手动登记及地址隐藏。
- 支持 29 种显示类型和本地 SVG 图标；名称和少量有来源的厂商线索用于推测，用户可手动覆盖。
- 刷新列表只读取现有发现数据；“扫描局域网”由用户主动触发，需要写权限。
- 只读账号可查看、刷新和单设备 Ping，不能修改记录或启动批量扫描。
- 使用 LuCI 原生语言设置和翻译包，不覆盖浏览器或 LuCI 的语言选择。

The application distinguishes confirmed online, offline and unknown states.
Filters and sortable columns support device groups, status and text searches.
Manual registration, details, one-device Ping and address masking are available.
Type recognition is a best-effort display hint with a manual override; see
[identification rules and provenance](docs/device-identification.md).

## Installation

On OpenWrt releases whose feeds include this application, install it
from the configured package repositories.

For systems using opkg:

```sh
opkg update
opkg install luci-app-device-manager
opkg install luci-i18n-device-manager-zh-cn
```

For systems using apk:

```sh
apk update
apk add luci-app-device-manager
apk add luci-i18n-device-manager-zh-cn
```

The Chinese language package is optional. Without a translation, LuCI
displays the English source messages. Reload LuCI after installation
and open **Network → Device Manager**.

Dependencies are resolved by the package manager. Standard OpenWrt
BusyBox supplies the required `ip` and `flock` applets. Custom firmware
that disables these applets must enable them or install `ip-tiny`
(or `ip-full`) and `flock` separately.

## 扫描范围 / Scan scope

默认仅扫描 netifd 的逻辑接口 `lan`。从接口的 `l3_device` 和内核 IPv4 地址获取真实网段，
不会根据全局路由表选择 WAN，也不会假设网段为 `/24`。

To add a separate trusted LAN, list its logical netifd interface explicitly:

```uci
config settings 'settings'
    list scan_interface 'lan'
    list scan_interface 'guest'
```

An existing configuration without settings defaults to `lan`. An explicitly
empty `scan_interface` disables scanning. At most eight interfaces and 64
subnets are considered. Never add an uplink interface unless probing that
interface is intentionally required.

Each Ping is bound to the selected LAN device. Router, network and broadcast
addresses are excluded; known leases and neighbors are also checked against
the selected subnet. Prefixes with at most 4096 addresses can be enumerated.
Larger subnets probe known in-scope hosts only. IPv6 is discovered passively;
single-device Ping can use a known IPv6 address.

Batch scans share a lock, allow at most 16 concurrent children and 128 targets
per request, stop after about eight seconds and use a 30-second cooldown
measured after completion. Further eligible clicks resume the sweep.
An unanswered ICMP Ping does not by itself prove a device is offline.

## Development

This application is built in the LuCI feed with the standard luci.mk.
Independent SDK workflows, tests and deployment tools are maintained in
[the source repository](https://github.com/xxi-arch/luci-app-device-manager).

## 真实设备验收 / Router acceptance

1. Install the package and optional Chinese translation on a matching system;
   verify English and Chinese language selection and a second LuCI language.
2. Save a device name, note, type and group; upgrade the package and reboot;
   verify that the records and an intentionally empty group list survive.
3. Use a read-only account: verify refresh and details, and ensure editing and
   batch scanning are denied by the RPC ACL even when called directly.
4. On isolated `/25` and `/23` LANs, inspect packet captures while scanning;
   verify interface binding, subnet boundaries, concurrency and cooldown.
5. Test standard BusyBox `ip` and optionally `ip-tiny`/`ip-full`, an unavailable LAN,
   IPv6-only details, Wi-Fi VLAN stations and incomplete discovery sources.
6. Check the stock Bootstrap/OpenWrt themes on desktop and mobile, including
   dark mode, keyboard controls and dialogs.

## 许可证 / Licensing

Project code: MIT, see [LICENSE](LICENSE). Material Design Icons: Apache-2.0,
with source revision, per-icon URLs and local changes recorded under
[device-icons](htdocs/luci-static/resources/device-manager/device-icons/NOTICE).
Both applicable licenses are declared in the package Makefile.
