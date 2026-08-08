# luci-app-wificalling-gateway

Per-device transparent Wi-Fi Calling gateway for OpenWrt / ImmortalWrt.

Routes selected LAN clients through a sing-box node (AnyTLS, Hysteria2,
TUIC, VLESS Reality, VMess WebSocket) with nftables TPROXY, observes
ePDG/IPsec UDP 500/4500 evidence, and records handshake outcomes in an
encrypted IMS activity log.

See https://github.com/smthdagg/luci-app-wificalling-gateway for full docs.
