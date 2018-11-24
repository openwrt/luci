OpenWrt LuCI for ShadowsocksR-libev
===

简介
---

本软件包是 [ShadowsocksR-libev][openwrt-shadowsocksr] 的 LuCI 控制界面

方便用户控制和使用「透明代理」「SOCKS5 代理」「端口转发」功能.

特色功能：服务器订阅、DNS 防污染

依赖
---
软件包的正常使用需要依赖 `iptables` 和 `ipset`.  
软件包不显式依赖 `shadowsocksr-libev`, 会根据用户添加的可执行文件启用相应的功能.  
可执行文件可通过安装 [ShadowsocksR-libev][openwrt-shadowsocksr] 中提供的 `shadowsocks-libev` 获得.  
只有当文件存在时, 相应的功能才可被使用, 并显示相应的 LuCI 设置界面.  

 可执行文件    | 可选 | 功能        | TCP协议 | UDP协议 
 -------------|------|------------|---------|-----------------------------------
 `ssr-redir`  | 是   | 透明代理    | 支持    | 需安装 `iptables-mod-tproxy`, `ip`
 `ssr-local`  | 是   | SOCKS5 代理 | 支持    | 支持
 `ssr-tunnel` | 是   | 端口转发    | 支持    | 支持

注: 可执行文件在 `$PATH` 环境变量所表示的搜索路径中, 都可被正确调用.

可选依赖               | 作用
-------------------|--------------------
`dnsmasq-full`     | DNS 域名污染列表解析
`curl`             | 获取 DNS 域名污染列表和服务器订阅数据
`coreutils-base64` | base64 解码 DNS 域名污染列表和服务器订阅数据
`bash`             | 服务器订阅脚本使用 bash 解释器运行
`bind-dig`         | 用于订阅脚本解析域名

软件包不显式这些依赖，会根据用户安装的依赖启用相应的功能.

DNS 防污染支持的软件包：`cdns`、`dns-forwarder`、`https_dns_proxy`、`pdnsd`，这些软件包可以在我的 GitHub 以及 opkg 软件源找到.


编译
---

从 OpenWrt 的 [SDK](https://wiki.openwrt.org/doc/howto/obtain.firmware.sdk) 编译  
```bash
# 解压下载好的 SDK
tar xjf OpenWrt-SDK-ar71xx-for-linux-x86_64-gcc-4.8-linaro_uClibc-0.9.33.2.tar.bz2
cd OpenWrt-SDK-ar71xx-*
# Clone 项目
git clone https://github.com/Hill-98/luci-app-shadowsocks.git package/luci-app-shadowsocks
# 编译 po2lmo (如果有po2lmo可跳过)
pushd package/luci-app-shadowsocksr/tools/po2lmo
make && sudo make install
popd
# 选择要编译的包 LuCI -> 3. Applications
make menuconfig
# 开始编译
make package/luci-app-shadowsocksr/compile V=99
```

 [openwrt-shadowsocksr]: https://github.com/Hill-98/shadowsocksr-libev_openwrt

[dns-forwarder]: https://github.com/aa65535/openwrt-dns-forwarder