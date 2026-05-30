# luci-app-https-dns-proxy

[![OpenWrt](https://img.shields.io/badge/OpenWrt-Compatible-blueviolet)](https://openwrt.org)
[![Web UI](https://img.shields.io/badge/Web_UI-Available-blue)](https://docs.openwrt.melmac.ca/https-dns-proxy/)
[![Resolvers](https://img.shields.io/badge/Resolvers-40%2B%20Built--in-brightgreen)](https://docs.openwrt.melmac.ca/https-dns-proxy/)
[![Minimal Footprint](https://img.shields.io/badge/Size-~40KB-green)](https://github.com/stangri/https-dns-proxy)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](https://github.com/stangri/https-dns-proxy/blob/master/LICENSE)

A WebUI for lightweight, RFC8484-compliant DNS-over-HTTPS (DoH) proxy service for OpenWrt.  
Includes optional integration with `dnsmasq`, automatic fallback, and canary domain support.

## Features

- Small footprint (~40KB installed)
- Seamless dnsmasq integration and fallback
- LuCI Web UI with 40+ built-in resolvers

**Full documentation:**

[https://docs.openwrt.melmac.ca/https-dns-proxy/](https://docs.openwrt.melmac.ca/https-dns-proxy/)

Based on [@aarond10](https://github.com/aarond10)'s excellent [https_dns_proxy](https://github.com/aarond10/https_dns_proxy)
