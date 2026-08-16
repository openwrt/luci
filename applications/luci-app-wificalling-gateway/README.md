# Wi-Fi Calling Gateway

[English](README_EN.md) · [安装](docs/zh-CN/INSTALL.md) · [配置](docs/zh-CN/CONFIGURATION.md) · [排错](docs/zh-CN/TROUBLESHOOTING.md) · [开发与维护](DEVELOPER.md)

面向 OpenWrt / ImmortalWrt 的独立 LuCI 插件。它把指定局域网设备通过指定的 sing-box 节点转发，同时让其他设备继续走路由器默认路由，并观察 Wi‑Fi Calling 常用的 ePDG/IPsec UDP 500、4500 会话证据。

### 设置

![Wi-Fi Calling Gateway 设置页面](docs/images/overview.png)

### Wi-Fi Calling 状态

![Wi-Fi Calling 状态页面](docs/images/device-status.png)

### 活动日志

![加密 IMS 活动日志页面](docs/images/activity-log.png)

### iPhone 实机观察

下图为实际 iPhone 在飞行模式及 Wi‑Fi 环境中显示 **EE WiFiCall** 的状态：

<p align="center">
  <img src="docs/images/iphone-ee-wificall.jpg" alt="iPhone 实机显示 EE WiFiCall" width="420">
</p>

该截图证明终端已显示 Wi‑Fi Calling 注册状态；是否完成号码激活及呼叫能力，仍应以实际通话或运营商确认结果为准。

## 功能

- 支持 **AnyTLS、Hysteria2、TUIC、VLESS Reality、VMess WebSocket、Trojan 与 WireGuard** 七种节点协议。
- 支持直接粘贴 AnyTLS、Hysteria2/Hy2、TUIC、VLESS、VMess、Trojan (trojan://)、WireGuard (wg://) 分享链接，以及标准 WireGuard `[Interface]/[Peer]` 配置块；WireGuard 支持预共享密钥（PSK）。
- **WireGuard 节点真实握手健康检查**：不用 ICMP 猜，临时起 sing-box endpoint 验证隧道握手并显示验证通过的出口 IP（60 秒缓存）。
- **DHCP 静态租约自动管理**：添加/删除设备策略时自动绑定/清理 MAC-IP 静态租约，兼容 iOS 私有 Wi-Fi 地址（MAC 随机变化）；设备策略表实时显示绑定状态（已绑定 / 待绑定 / MAC 已变化 / 设备未在线）。
- **从已连接设备直接添加**：编辑设备策略时可从 DHCP/ARP 检测到的在线设备中选择，自动填写名称与 IP（静态 IP / 纯 AP 路由器场景由 ARP 兜底判断在线）。
- **服务健康监控**：「Wi-Fi Calling 状态」页顶部显示 sing-box/monitor 进程、配置有效性、**配置过期告警**（改了配置没重启服务）、nftables 规则数、节点健康汇总。
- 每台设备可绑定一个节点；一个策略可包含多个固定私网 IPv4 地址。
- `独立通道`：通过插件节点转发；`跟随网关`：插件不拦截，设备走路由器默认路由。
- 单个 sing-box 进程、nftables TPROXY、TCP 与 UDP 透明转发。
- 节点 ICMP/TCP 可达性与延迟检测（TCP 系协议在 ICMP 被阻断时自动回退 tcping）。
- 内置简体中文界面（语言包随安装包提供）；中文说明与状态，协议名与技术字段（TLS、UDP、UUID、SNI、ALPN、Reality、WebSocket 等）保留英文。
- 设置、Wi‑Fi Calling 状态、加密 IMS 活动日志分为三个独立管理页面。
- 观察 UDP 500/4500，显示注册状态、ePDG、ASSURED、包计数及最后活动时间。
- 只记录握手成功/失败与持续加密通讯（响铃或通话，持续数秒以上）；每台设备默认独立保留最近 20 条，可在设置中调整或关闭活动日志。
- 启动前执行 `sing-box check`；配置和运行时凭据权限设为 `0600`。

## 节点协议选择（重要）

> **⚠️ 网关出口节点请使用 TCP 系协议（AnyTLS / VLESS / VMess / Trojan）。**
>
> - TCP 系在公网丢包/抖动下提供可靠有序的传输，IPsec keepalive 与 RTP 语音不丢，适合作为 Wi‑Fi Calling 出口。
> - **UDP/QUIC 系（Hysteria2、TUIC）实测不适合**：节点的"在线"状态仅代表 ICMP 可达（不是代理握手成功），UDP-in-UDP 在公网抖动下会导致拨号立即中断；曾实测因 Hysteria2 节点代理链路不通导致被路由设备**无互联网**。
> - WireGuard 为 UDP 协议但自带保活与重传机制，可作为出口（插件自动适配 sing-box ≥1.11 的 endpoint 形式）。

## 为什么要绑定 DHCP 静态 IP

本插件的防火墙规则**按 IP 识别设备**：设备策略里填写的 `source_ip` 会被写入 nftables 的 `clients4` 集合，凡是匹配该 IP 的流量才会被 TPROXY 转发到 sing-box 节点。**如果设备实际拿到的 IP 与策略不一致，规则就匹配不到，设备流量不会经过网关**——这曾经是"配置了但没生效"的最常见原因。

因此设备 IP 必须固定，固定方式就是 DHCP 静态租约（把设备的 MAC 与策略 IP 绑定）。从 1.7.0 起插件在服务启动时自动从当前租约同步这份绑定：

- 添加设备策略 → 自动为策略 IP 绑定当前使用该 IP 的设备的 MAC；
- 删除设备策略 → 自动清理对应绑定；
- iOS 的"私有无线局域网地址"导致 MAC 变化时，设备重连 Wi-Fi（或重启）后插件自动按新 MAC 重新绑定，无需手工改配置。

设备策略表里的「DHCP 绑定」列实时显示状态：`已绑定` / `待绑定`（设备在线但尚未绑定）/ `MAC 已变化，重连后自动重绑` / `设备未在线`。

## 监控能力边界（重要）

Wi‑Fi Calling 的 ePDG/IPsec 隧道（UDP 4500 内）**全程加密**，路由器只能观察到外层隧道的包量，看不到隧道内的 SIP 信令、语音或短信内容。因此：

- **通话可以推断**：注册后出现持续双向加密流量（响铃或通话的 RTP 特征，持续数秒以上）→ 活动日志标记为「**通话进行中（根据持续加密流量推断）**」；
- **短信无法可靠区分**：短信（IMS 短信）是短突发流量，与 keepalive、系统推送等无法区分，因此**不记录**，也不会误报为短信；
- **电话号码、消息内容、呼叫方向永远不可见**。

活动日志记录的是：握手成功 / 握手失败 / 持续通讯（推断为通话）。这是路由器侧的网络证据，不是运营商侧的确认。

## 设备使用提示

- iOS 默认启用"私有无线局域网地址"，MAC 会随机变化，导致手工 DHCP 绑定失效。本插件（≥1.7.0）在服务启动时自动从当前租约重新绑定设备 MAC，**设备重连 Wi-Fi（或重启）即可自动恢复**，无需手工改配置。
- 添加设备策略后，若设备 IP 与策略不符，重启设备网络（关 Wi-Fi 再开）让其重新获取 DHCP 地址。

## 支持环境

| 项目 | 支持范围 |
|---|---|
| 固件 | OpenWrt / ImmortalWrt / iStoreOS（22.03+ / 23.05+ 系），nftables + TPROXY；**18.06/Lede 有专包**（见下方「18.06 专包」） |
| 24.10 系（opkg/IPK） | OpenWrt 24.10、ImmortalWrt 24.10、iStoreOS 24.10 共用一个 IPK，全部实测 |
| 25.12 系（apk/APK） | OpenWrt / ImmortalWrt 25.12 共用一个 noarch APK，四种芯片全部实测 |
| 25.12 芯片实测 | x86_64 ✅ aarch64 ✅ armv7 ✅ mipsel ✅（官方 25.12.3 rootfs + qemu 用户态模拟） |
| 已实机验证 | ImmortalWrt 24.10.6，Redmi AX6S，aarch64_cortex-a53（真实路由器） |
| iStoreOS 实测 | **24.10.7 完整固件（QEMU 全系统模拟，与用户报错同版本）**：安装 + 服务 active + LuCI 设置/状态/活动日志页面全中文实测通过 |
| 容器/模拟验证 | OpenWrt 24.10.8 / 25.12.3 官方 rootfs；iStoreOS 24.10.5（Docker）、24.10.7（QEMU 完整固件） |
| sing-box | 建议 1.13.0 或更高；IPK 不锁版本（兼容各源较旧版本），25.12 官方源自带（armv7/mipsel 实测自动装 1.12.17）。WireGuard 节点自动适配：sing-box ≥1.11 用 endpoint 形式，1.10.x 及更早用旧版 outbound（均经 1.10.0/1.11.7/1.12.0/1.13.18 实测） |
| LuCI | JavaScript 视图（现代 LuCI） |
| 网络 | IPv4 LAN 策略；设备策略自动同步 DHCP 静态租约（增删设备自动绑定/清理 MAC-IP，兼容 iOS 私有 MAC 变化） |
| 包架构 | IPK `all`（Shell 与 LuCI 资源）；APK `noarch`（25.12 apk 不接受 `all`，官方包按目标架构分发） |

依赖：`luci-base`、`sing-box`、`nftables`、`kmod-nft-tproxy`、`kmod-nft-socket`、`ip-full`。（插件直接配置 nftables，不依赖 firewall4 守护进程；1.7.1 及更早依赖里写死的 `firewall4` 正是 18.06/Lede 上安装失败的根因，1.7.2 起已移除。）

## 快速安装

从 [Releases](../../releases) 下载最新稳定版（当前为 1.7.3），上传到路由器后安装。**24.10 全系用一个 `.ipk`，25.12 全系用一个 `.apk`（noarch，不分芯片）**。

**OpenWrt / ImmortalWrt / iStoreOS 24.10.x（opkg / IPK）** —— 一个包通用，已实机验证：

```sh
opkg update
opkg install ./luci-app-wificalling-gateway_1.7.3-1_all.ipk
/etc/init.d/rpcd restart
```

> iStoreOS 提示：部分 opkg 对 `./` 相对路径或上传位置会报误导性的 "No such file or directory"。请确认文件**真实上传成功**后再用绝对路径安装：
>
> ```sh
> opkg install /root/luci-app-wificalling-gateway_1.7.3-1_all.ipk
> ```
>
> 若 iStoreOS 的定制 opkg 对本地文件报 `incompatible with the architectures configured`（已实测），可改用**解包安装**（24.10.7 完整固件实测通过）：
>
> ```sh
> cd /tmp && tar xzf luci-app-wificalling-gateway_1.7.3-1_all.ipk && tar xzf data.tar.gz -C /
> /etc/init.d/wificalling-gateway enable && /etc/init.d/wificalling-gateway start
> ```

**OpenWrt / ImmortalWrt 25.12.x（apk / APK）** —— 一个 noarch 包，覆盖 x86_64 / aarch64 / armv7 / mipsel 全芯片，已全部实测：

```sh
apk update
apk add --allow-untrusted ./luci-app-wificalling-gateway_1.7.3-r1_noarch.apk
/etc/init.d/rpcd restart
```

然后进入 **服务 → Wi‑Fi Calling Gateway**。先添加并保存节点，再添加设备策略。详细步骤见[安装说明](docs/zh-CN/INSTALL.md)和[配置说明](docs/zh-CN/CONFIGURATION.md)。

### 18.06/Lede 专包

18.06 的软件源没有 `firewall4`，也通常没有 sing-box 与 TPROXY 内核模块，通用包在 18.06 上装不上。Release 里的 **`luci-app-wificalling-gateway_1.7.3-1_18.06_all.ipk`** 专包只依赖 18.06 源自带的 `luci-base`、`nftables`、`ip-full`（官方 18.06.9 rootfs 实测安装成功）：

```sh
opkg update
opkg install ./luci-app-wificalling-gateway_1.7.3-1_18.06_all.ipk
/etc/init.d/wificalling-gateway enable
```

注意：

- **LuCI 页面**依赖 19.07+ 的 JS 视图架构，18.06 的 Lua dispatcher 无法渲染，专包因此不注册菜单；配置请走命令行 UCI（`uci set wificalling-gateway.main.enabled=1` 等）。
- **sing-box 与 TPROXY 内核模块**（内核 ≥ 4.11）需要你的源提供；缺失时服务启动会通过 `logread -e wificalling-gateway` 给出明确原因。

## 重要边界

> **⚠️ 定位要求（Wi-Fi Calling 生效前提）**
>
> 运营商要求设备定位与 SIM 卡归属地一致才能激活 Wi-Fi Calling。本插件通过对应国家的节点提供该国 IP，但**不控制设备自身的定位**（GPS / 基站 / wloc）。设备需要通过虚拟定位将位置设为 SIM 卡归属地，否则 Wi-Fi Calling 无法触发。
>
> **解决方法**：使用 [ios-location-spoofer](https://github.com/smthdagg/ios-location-spoofer) 配合小火箭（Shadowrocket）劫持 iOS 定位到 SIM 卡归属地。这是独立于本插件的项目。

本插件只提供网络转发和可观察证据，不修改手机定位、运营商账户、IMS 配置或紧急呼叫地址。`likely_registered` 仅表示观察到双向 `ASSURED` UDP 4500；Wi‑Fi Calling 图标、UDP 500/4500 或高流量均不能单独证明号码已激活或电话一定能接通。请遵守运营商条款和所在地法律，并在真实设备上完成通话验证。

## 项目文档

- [安装与升级](docs/zh-CN/INSTALL.md)
- [节点和设备配置](docs/zh-CN/CONFIGURATION.md)
- [常见问题与排错](docs/zh-CN/TROUBLESHOOTING.md)
- [开发与维护（面向贡献者 / 自动化接管）](DEVELOPER.md)
- [安全策略](SECURITY.md) · [更新记录](CHANGELOG.md)

## 许可证

[MIT](LICENSE)。本项目与 Apple、任何移动运营商、OpenWrt、ImmortalWrt、sing-box 或 PassWall 均无隶属关系。
