# LuCI web interface for mitmproxy 12.2.3 on OpenWrt 25.12.x

Run [mitmproxy](https://mitmproxy.org/), the interactive HTTPS-intercepting proxy, on an OpenWrt 25.12 router, and manage it from LuCI.


| Package | File | What it contains |
|---|---|---|
| **mitmproxy** (core) | `mitmproxy_12.2.3-r2_noarch.apk` | The proxy engine and its **mitmweb** web UI (ports 8080/8081), start-up script, configuration |
| **luci-app-mitmproxy** | `luci-app-mitmproxy_1.0.0-r3_noarch.apk` | LuCI pages under **Services → mitmproxy**: status, settings, rules, alerts, traffic analysis |

Install both. The core package works without LuCI, but the LuCI pages need the core package.

---

## What it does

- **Intercepts and inspects HTTP and HTTPS traffic** from devices on your LAN: every request and response with headers, bodies, timing and TLS details.
- **Two ways to capture traffic:**
  - **Regular mode**: devices use `<router-ip>:8080` as their HTTP/HTTPS proxy.
  - **Transparent mode**: the router redirects LAN web traffic (TCP ports 80 and 443) to the proxy automatically. Devices need no proxy setting.
- **mitmweb**, mitmproxy's own web UI on port **8081**: browse flows live, intercept and edit requests, replay, export.
- **Traffic rules from LuCI:** block requests, add/change/remove headers, search-and-replace in bodies, answer requests with a local file (map local), redirect to another URL (map remote).
- **Dashboard and analysis in LuCI**, calculated from the captured traffic:
  - status, memory, uptime and a one-click **Open mitmweb** button;
  - protocol mix, status codes, methods, top hosts and clients;
  - behavior checks: request bursts, periodic "beaconing" connections, upstream TLS problems (expired, self-signed, wrong name, old TLS), large uploads, executable downloads, failing hosts;
  - security indicators: pattern rules for SQL injection, command injection, Log4Shell, path traversal, XSS and credentials sent over plain HTTP.

The analysis is rule-based (fixed thresholds and regular expressions), not AI. It looks at URLs, headers, sizes and timing, not at request bodies.

---

## How it works

```
 LAN device ──► router :8080  mitmproxy (proxy engine) ──► Internet
                     │
                     └─ :8081 mitmweb (web UI + API, needs a token)
                                   ▲
 LuCI (Services → mitmproxy) ──────┘ reads /flows with the token,
                                     "Open mitmweb" button links here
```

- **One process, two ports.** The start-up script runs `mitmweb`. It is the proxy on **8080** and the web UI on **8081** at the same time.
- **Login token.** mitmweb only answers requests that carry a token. On first start the script creates a random 32-character token and stores it as `mitmproxy.main.web_password`, so the token stays the same across restarts and LuCI can use it.
- **Configuration** lives in `/etc/config/mitmproxy` (UCI). LuCI edits it, and saving restarts the service automatically.
- **Transparent mode** adds an nftables table `inet mitmproxy` that redirects IPv4 ports 80/443 arriving on the LAN interface (default `br-lan`) to port 8080. Traffic addressed to the router itself is not redirected. The table is removed when the service stops or the mode changes.
- **HTTPS** is decrypted with mitmproxy's own certificate authority (CA), stored in `/etc/mitmproxy/certs`. Each device must trust that CA, otherwise it shows certificate errors.

### Why it runs on a router without compiling anything

mitmproxy is written in Python, so the package holds Python source code plus a few small shell scripts. Two parts of mitmproxy normally need compiled code that has no ready-made build for OpenWrt (musl libc):

- **`mitmproxy_rs`** (Rust): replaced by a small pure-Python stand-in;
- **`aioquic`** (C parts `_buffer` and `_crypto`): the Python files are shipped with pure-Python stand-ins for the C parts.

The remaining Python libraries (cryptography, tornado, flask, …) are installed by the package's install script with pip, using ready-made musl wheels from PyPI (no compiler needed).

**Not available** because of the stand-ins: HTTP/3 (QUIC), WireGuard mode, local-redirect mode and TUN mode. Normal HTTP/1, HTTP/2, HTTPS and WebSocket interception works.

---

## Supported routers

| Router | CPU | Status |
|---|---|---|
| GL.iNet GL-MT6000 Flint 2 | aarch64 | Supported (tested) |
| GL.iNet GL-MT3000 Beryl AX | aarch64 | Supported (needs ~100 MB free storage) |
| GL.iNet GL-MT3600BE Beryl 7 | aarch64 | Supported |
| Linksys WRT1200AC / 1900AC / 3200ACM / 32X | armv7 | **Not supported by these packages.** PyPI has no ready-made armv7 musl builds of cryptography, cffi, bcrypt and others. Use `fw-setup.sh -mitmproxy-compat` instead (Regular mode only) |

Requirements on the router: OpenWrt 25.12, Python 3.13 (installed automatically as a dependency), internet access during installation, roughly 100 MB of storage and 60 MB of free RAM for mitmweb.

---

## Install from the APK files (easiest)

1. Copy both files to `/tmp` on the router:

   ```sh
   scp -O mitmproxy_12.2.3-r2_noarch.apk luci-app-mitmproxy_1.0.0-r3_noarch.apk root@<router-ip>:/tmp/
   ```

2. On the router:

   ```sh
   cd /tmp
   apk add --allow-untrusted mitmproxy_12.2.3-r2_noarch.apk luci-app-mitmproxy_1.0.0-r3_noarch.apk
   [ -f /etc/init.d/mitmproxy.apk-new ] && mv /etc/init.d/mitmproxy.apk-new /etc/init.d/mitmproxy && chmod 755 /etc/init.d/mitmproxy
   uci set mitmproxy.main.enabled=1 && uci commit mitmproxy
   /etc/init.d/mitmproxy enable
   /etc/init.d/mitmproxy restart
   rm -rf /tmp/luci-modulecache /tmp/luci-indexcache*
   ```

   The install takes a few minutes while pip downloads the Python libraries. The `.apk-new` line only matters when upgrading over an older, hand-edited start-up script; otherwise it does nothing.

3. Wait about a minute (mitmproxy starts slowly on a router CPU), then check:

   ```sh
   netstat -lnt | grep -E ':808[01]'
   wget -q -O - "http://127.0.0.1:8081/flows?token=$(uci get mitmproxy.main.web_password)" | head -c 100; echo
   ```

   Ports 8080 and 8081 should be listening, and `wget` should print `[]` or some JSON.

4. Open LuCI → **Services → mitmproxy**.

---

## Using it

### Open mitmweb (port 8081)

Click **Open mitmweb** on the LuCI Status page. It opens `http://<router-ip>:8081/?token=…`, which logs you in and shows the flow list (`#/flows`). Or build the link yourself:

```sh
echo "http://<router-ip>:8081/?token=$(uci get mitmproxy.main.web_password)"
```

mitmweb is where you inspect individual requests in full, intercept and edit them, replay them and export captures. The LuCI pages are a summary dashboard built on the same data.

### Capture traffic

- **Regular mode (default):** set `<router-ip>:8080` as the HTTP and HTTPS proxy on a device.
- **Transparent mode:** LuCI → **Settings → Proxy Mode → Transparent**, then save. All LAN web traffic is captured. If your LAN interface is not `br-lan`, set **Intercept Interface** (check with `uci get network.lan.device`). To verify: `nft list table inet mitmproxy`.

### Trust the CA for HTTPS

On each device whose HTTPS traffic you want to inspect, browse to **`http://mitm.it`** while its traffic goes through the proxy, and install the certificate for that operating system or browser. Without it, HTTPS sites show certificate errors.

Apps that pin their certificates (banking apps, many mobile apps) cannot be intercepted even with the CA installed. Add their domains to **Settings → Interception → Ignore Hosts** (for example `.*\.apple\.com`) so they pass through untouched.

---

## Configuration (`/etc/config/mitmproxy`)

Everything below can be set in LuCI. Saving restarts the service.

| Section.option | Default | Meaning |
|---|---|---|
| `main.enabled` | `0` | The service only starts when this is `1` |
| `main.mode` | `regular` | `regular`, `transparent`, `socks5`, `upstream`, `reverse` |
| `main.upstream_server` | | Required for `upstream` / `reverse`, e.g. `http://10.0.0.2:3128` |
| `main.listen_host` / `main.listen_port` | `0.0.0.0` / `8080` | Proxy address and port |
| `main.transparent_iface` | `br-lan` | Interface redirected in transparent mode |
| `main.web_host` / `main.web_port` | `0.0.0.0` / `8081` | mitmweb address and port |
| `main.web_password` | created on first start | mitmweb token; clear it to generate a new one |
| `main.confdir` | `/etc/mitmproxy/certs` | CA certificate and mitmproxy data |
| `main.ssl_insecure` | `0` | `1` = do not verify upstream server certificates |
| `main.script` | | Path to a mitmproxy addon script |
| `main.extra_args` (list) | | Extra mitmweb arguments, split on spaces |
| `interception.intercept` | | Flow filter for flows to intercept, e.g. `~d example.com & ~m POST` |
| `interception.ignore_hosts` / `allow_hosts` (lists) | | Host regexes to pass through / to intercept exclusively |
| `interception.anticache` / `anticomp` | `0` | Strip cache / compression headers |
| `logging.log_level` | `info` | `error`, `warn`, `info`, `debug` (shown in `logread`) |

Rule sections (edited on the LuCI **Rules** page): `blocklist`, `modify_header`, `modify_body`, `map_local`, `map_remote`. Each has an `enabled` flag and uses mitmproxy [flow filters](https://docs.mitmproxy.org/stable/concepts-filters/).

Settings and the CA key are kept across firmware upgrades (`/lib/upgrade/keep.d/mitmproxy`).

---

## Build the packages from source

Both build scripts are self-contained Python 3 scripts with the APK v3 writer built in. They run on any Linux PC (Python 3.12 or newer, `pip`, internet access). Nothing is compiled.

### LuCI source layout

```
luci-app-mitmproxy/
├── Makefile                                  OpenWrt SDK package definition
├── luasrc/controller/mitmproxy.lua           menu entries + JSON endpoints (status, flows, alerts, actions)
├── luasrc/model/cbi/mitmproxy/settings.lua   Settings page
├── luasrc/model/cbi/mitmproxy/rules.lua      Rules page
├── luasrc/view/mitmproxy/status.htm          Status dashboard
├── luasrc/view/mitmproxy/alerts.htm          Alerts (system log)
├── luasrc/view/mitmproxy/traffic.htm         Traffic analysis
└── htdocs/luci-static/mitmproxy/analysis.js  analysis engine (runs in the browser)
```

The LuCI pages use the Lua framework, so the package depends on `luci-compat`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| LuCI says **Stopped** and nothing listens on 8081 | `uci set mitmproxy.main.enabled=1 && uci commit mitmproxy && /etc/init.d/mitmproxy restart`, then wait a minute. Errors: `logread \| grep mitm \| tail -20` |
| **Open mitmweb** greyed out, Traffic page says "mitmweb did not answer" | No token: `uci get mitmproxy.main.web_password` is empty. Usually an old start-up script is still in use, see the next row |
| Install printed `Installing file to etc/init.d/mitmproxy.apk-new` | The old script was edited, so apk kept it. Run `mv /etc/init.d/mitmproxy.apk-new /etc/init.d/mitmproxy && chmod 755 /etc/init.d/mitmproxy`, then restart |
| Traffic page shows 0 flows | In Regular mode only devices configured to use the proxy are captured. Test from a LAN PC: `curl -x http://<router-ip>:8080 http://example.com`, or switch to Transparent mode |
| HTTPS sites show certificate errors | Install the CA from `http://mitm.it` on that device, or add the site to Ignore Hosts |
| Page still shows old content after an upgrade | `rm -rf /tmp/luci-modulecache /tmp/luci-indexcache*` and reload the browser (Ctrl+F5) |
| Router memory keeps growing | mitmweb keeps every flow in RAM until it restarts: `/etc/init.d/mitmproxy restart` |

---

## Security notes

- mitmproxy decrypts HTTPS. Only use it on networks and devices you own or are authorized to test.
- Keep ports **8080** and **8081** closed on WAN. OpenWrt's default firewall (WAN input rejected) already does this; do not add port forwards to them.
- The mitmweb token gives full access to captured traffic. Don't share token links or post them in screenshots.
- The CA private key in `/etc/mitmproxy/certs` can sign certificates that every device trusting it will accept. Protect it, and remove the CA from devices when you are done testing.

## License

The packaging and LuCI app in this repository: see `LICENSE`. mitmproxy itself is MIT-licensed ([source](https://github.com/mitmproxy/mitmproxy)); aioquic is BSD-licensed.

## Screenshot
<br>
<img width="1501" height="1174" alt="image" src="https://github.com/user-attachments/assets/0ebae0d8-5b1e-41de-acbc-49e324737171" /><br>
<br>
<img width="1470" height="1184" alt="image" src="https://github.com/user-attachments/assets/bdb3650b-b189-49d1-9829-726a61502489" /><br>
<br>
<img width="1502" height="1173" alt="image" src="https://github.com/user-attachments/assets/82060114-6416-4a71-bde8-9b9217661f5c" /><br>
<br>
<img width="1514" height="758" alt="image" src="https://github.com/user-attachments/assets/a7cd9a0c-8d30-49f2-af3a-ff12c16eb59e" /><br>
<br>
<img width="1415" height="653" alt="image" src="https://github.com/user-attachments/assets/efcd0564-351e-47fb-b233-cac82ae6267f" /><br>
<br>
<img width="1410" height="651" alt="image" src="https://github.com/user-attachments/assets/497d4217-41c3-4f93-9add-912643bc3ca7" /><br>
<br>
<img width="1412" height="649" alt="image" src="https://github.com/user-attachments/assets/dd89d135-124b-4bef-8829-4960a6c543e8" />
