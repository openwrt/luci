# luci-app-rustdesk-server

LuCI web interface for [RustDesk Server](https://github.com/rustdesk/rustdesk-server) on OpenWrt.
It configures the two daemons, `hbbs` (ID/rendezvous server) and `hbbr` (relay server), shows
whether they run, and displays the server public key that clients need.

## Install

```
opkg install luci-app-rustdesk-server
```

This pulls in the `rustdesk-server` package, which ships the binaries, the init script and the
UCI config. The optional `rustdesk-utils` package adds the upstream command line tool.

## Where things live

- `/etc/config/rustdesk-server` - UCI configuration, edited by this app.
- `/etc/init.d/rustdesk-server` - procd init script, runs both daemons as instances `hbbs` and `hbbr`.
- `/etc/rustdesk/` - working directory holding `id_ed25519` and `id_ed25519.pub`. The key pair is
  kept across sysupgrade; losing it means every client has to be paired again.
- `/tmp/rustdesk_db_v2.sqlite3` - the ID server database. It lives in RAM and is rebuilt on boot.

## Client setup

In the RustDesk client, under Settings, Network, ID/Relay Server:

- ID Server: `<router host or IP>:21116`
- Relay Server: `<router host or IP>:21117`
- Key: the public key shown on the General tab, Copy button included.

## Firewall

The "Open firewall ports" option on the General tab lets the init script hand fw4 the rules for
both daemons, derived from the configured ports: TCP 21115 to 21119 plus UDP 21116 with the
defaults. Leave it off if you prefer to write the traffic rules yourself.

## Troubleshooting

- `logread -e hbb` shows what the daemons print.
- `service rustdesk-server status` lists the running instances.
- No public key on the page means the service has not started yet; the key is created on first run.
- The client must reach both ports; check the firewall option above or your own traffic rules.
- Raise `RUST_LOG` to `debug` on either tab for more detail.
