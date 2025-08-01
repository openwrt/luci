# luci-app-adblock-fast

[![OpenWrt](https://img.shields.io/badge/OpenWrt-Compatible-blueviolet)](https://openwrt.org)
[![Web UI](https://img.shields.io/badge/Web_UI-Available-blue)](https://docs.openwrt.melmac.ca/adblock-fast/)
[![Lightweight](https://img.shields.io/badge/Size-Lightweight-brightgreen)](https://openwrt.org/packages/pkgdata/adblock-fast)
[![License](https://img.shields.io/badge/License-AGPL--3.0--or--later-lightgrey)](https://github.com/stangri/adblock-fast/blob/master/LICENSE)

A WebUI for fast, lightweight DNS-based ad-blocker for OpenWrt that works with dnsmasq, smartdns, or unbound.  
It runs once to process and install blocklists, then exits — keeping memory usage low.

## Features of principal package

- Minimal runtime memory use
- Parallel blocklist download and processing
- Persistent cache support
- Optional Web UI for custom block/allow lists
- Reverts if DNS resolution fails after restart

📚 **Full documentation:**  
[https://docs.openwrt.melmac.ca/adblock-fast/](https://docs.openwrt.melmac.ca/adblock-fast/)
