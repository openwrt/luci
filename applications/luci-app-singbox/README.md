# luci-app-singbox

LuCI web interface for [sing-box](https://github.com/SagerNet/sing-box) on OpenWrt,
focused on **VLESS + REALITY** — the most censorship-resistant proxy protocol —
with selective traffic splitting, GeoSite rule presets, multi-server failover,
and real-time monitoring via sing-box's built-in Clash API.

## Features

- VLESS + REALITY with `xtls-rprx-vision` flow and uTLS fingerprint emulation
- Selective traffic splitting via GeoSite presets (YouTube, Google, Telegram,
  OpenAI, Spotify, Discord, Netflix, Microsoft, Apple, Amazon, …)
- Multi-server with `urltest` auto-failover
- Real-time dashboard (status, active server, uptime, traffic, sortable connections)
- Live log viewer (`logread`-backed, level filter, search, auto-refresh)
- Subscription import (base64-encoded `vless://` lists, deduplicated by name)
- Custom routing rules: GeoSite / IP CIDR / Domain with VPN / Direct / Block actions
- Network-wide ad blocking via `geosite-category-ads-all`
- Validation gate: every generated config is checked with `sing-box check`
  before deployment, so a typo never takes the router offline

## Requirements

- OpenWrt 22.03+ (tested on 24.10)
- sing-box 1.11.0+
- `kmod-tun`
- ~250 KB free overlay

## Architecture

UCI is the single source of truth. `generate-config.sh` reads
`/etc/config/singbox`, renders sing-box JSON, validates it with `sing-box check`,
and only then atomically replaces `/etc/sing-box/config.json`. A typo or missing
field never reaches the running daemon.

sing-box logs to stderr; procd's stdout/stderr capture relays it to syslog
(logd ring buffer). The Logs tab reads via `logread | grep sing-box`.

## License

GPL-2.0-or-later
