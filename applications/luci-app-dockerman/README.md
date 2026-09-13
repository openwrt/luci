# Dockerman JS

## Notice

After dockerd _v27_, docker will **remove** the ability to listen on sockets of the form

`xxx://x.x.x.x:2375` or `xxx://x.x.x.x:2376` (or `xxx://[2001:db8::1]:2375`)

unless you run the daemon with various `--tls*` flags. That is, dockerd will *refuse*
to start unless it is configured to use TLS. See
[here](https://docs.docker.com/engine/security/#docker-daemon-attack-surface)
[here](https://docs.docker.com/engine/deprecated/#unauthenticated-tcp-connections)
and [here](https://docs.docker.com/engine/security/protect-access/).

ucode is not yet capable of TLS, so if you want dockerd to listen on a port,
you have a few options.

Issues opened in the luci repo regarding connection setup will go unanswered.
DIY.

This implementation includes three methods to connect to the API. 


# API Availability


|                  | rpcd/CGI | (Proxy+)JS API | Controller |
|------------------|----------|----------------|------------|
| API              |    ✅    |        ✅      |      ✅    |
| File Stream      |    ❌    |        ✅      |      ✅    |
| Console Start    |    ✅    |        ❌      |      ❌    |
| WS Console       |    ❌    |        ✅      |      ❌    |
| Stream endpoints |    ❌    |        ✅      |      ✅    |

* Stream endpoints are docker API paths that continue to stream data, like logs

Dockerman uses a combination of rpcd and ucode Controller so API, Console via
ttyd and File Streaming operations are available. dockerd is configured by
default to use `unix:///var/run/docker.sock`, and is secure this way.


It is possible to configure dockerd to listen on e.g.:

`['unix:///var/run/docker.sock', 'tcp://0.0.0.0:2375']`

when you have a Reverse Proxy configured and to open up the JS API.

## Reverse Proxy

Use nginx or Caddy to proxy connections to dockerd which is configured with
`--tls*` flags, or communicates directly with `unix:///var/run/docker.sock`,
which adds the necessary `Access-Control-Allow-Origin: ...`
headers for browser clients. You might even be able to run a
docker container that does this. If you don't want to set a proxy up, use a
[browser plugin](#browser-plug-in).

https://github.com/lucaslorentz/caddy-docker-proxy
https://github.com/Tecnativa/docker-socket-proxy

## LuCI

Included is a ucode rpc API interface to talk with the docker socket, so all
API calls are sent via rpcd, and appear as POST calls in your front end at e.g.

http://192.168.1.1/cgi-bin/luci


All calls to the docker API are authenticated with your session login.

### Controller

Included also is a ucode based controller to forward requests more directly to
the docker API socket to avoid the rpc penalty, and stream file uploads and
downloads. These are still authenticated with your session login. The methods
to reach the controller API are defined in the menu JSON file. The controller
API interface only exposes a limited subset of API methods.


## JS API

A JS API is included in the front-end to connect to API endpoints, and it
will detect how dockerd is configured. If dockerd is configured with any

`xxx://x.x.x.x:2375` or `xxx://x.x.x.x:2376` (or `xxx://[2001:db8::1]:2375`)

the front end will attempt to connect using the JS API. More features are
available with a more direct connection to the API (via Proxy or using 
[browser plugin](#browser-plug-in)), like WebSockets to connect to container
terminals. WebSocket connections are not currently available in LuCI, or the
LuCI CGI proxy.

CGI's job is to parse the request, send the response and disconnect.


## Browser plug-in

To avoid setting up a Proxy, and attempt to communicate directly with the API
endpoint, whether or not configured with `-tls*` options, you can use a plug-in.
One which overrides (the absence of) `Access-Control-Allow-Origin` CORS headers
(dockerd does not add these headers).
For example:

https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/

https://addons.mozilla.org/en-US/firefox/addon/access-control-allow-origin/

https://addons.mozilla.org/en-US/firefox/addon/cors-unblock/

https://addons.mozilla.org/en-US/firefox/addon/cross-domain-cors/


The browser plug-in does not magically fix TLS problems when you have mTLS
configured on dockerd (mutual CA based certificate authentication).


# Architecture

## High-Level Architecture

### rpcd and controller
```
┌──────────────────────────────────────────────────────────────────┐
│                         OpenWrt/LuCI                             │
│                                                                  │
│  ┌─────────────────────┐                                         │
│  │   Browser / UI      │                                         │
│  │  containers.js      │                                         │
│  │  images.js          │                                         │
│  └──────────┬──────────┘                                         │
│             │                                                    │
│             │ 1. GET /admin/docker/container/inspect/id?x=y      │
│             V                                                    │
│  ┌──────────────────────────┐                                    │
│  │  LuCI Dispatcher         │                                    │
│  │  (dispatcher.uc)         │                                    │
│  │  - Parses URL path       │                                    │
│  │  - Looks up action       │                                    │
│  │  - Extracts query params │                                    │
│  └──────────┬───────────────┘                                    │
│             │                                                    │
│             │ 2. Call controller function(env)                   │
│             V                                                    │
│  ┌──────────────────────────┐                                    │
│  │  HTTP Controller         │                                    │
│  │  (docker.uc)             │                                    │
│  │  - container_inspect(env)│                                    │
│  │  - Gets params from env  │                                    │
│  │  - Creates socket        │                                    │
│  └──────────┬───────────────┘                                    │
│             │                                                    │
│             │ 3. Connect to Docker socket                        │
│             V                                                    │
│  ┌──────────────────────────┐                                    │
│  │  Docker Socket           │                                    │
│  │  /var/run/docker.sock    │                                    │
│  │  (AF_UNIX socket)        │                                    │
│  └──────────┬───────────────┘                                    │
│             │                                                    │
│             │ 4. HTTP GET /v1.47/containers/{id}/json            │
│             V                                                    │
│  ┌──────────────────────────┐                                    │
│  │  Docker Daemon 200 OK    │                                    │
│  │  - Creates JSON blob     │                                    │
│  │  - Streams binary data   │                                    │
│  └──────────┬───────────────┘                                    │
│             │                                                    │
│             │ 5. data chunks (32KB blocks)                       │
│             V                                                    │
│  ┌──────────────────────────┐                                    │
│  │  UHTTPd Web Server       │                                    │
│  │  - Receives chunks       │                                    │
│  │  - Writes to HTTP socket │                                    │
│  │  (no buffering)          │                                    │
│  └──────────┬───────────────┘                                    │
│             │                                                    │
│             │ 6. HTTP 200 + data stream                          │
│             V                                                    │
│  ┌──────────────────────────┐                                    │
│  │   Browser                │                                    │
│  │  - Receives data stream  │                                    │
│  │  - Processes response    │                                    │
│  │  - Displays result       │                                    │
│  └──────────────────────────┘                                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Request/Response Flow

### Container Export Flow

```
Browser               Ucode Controller     Docker
  │                      │                 │
  ├─ GET /admin/docker   │                 │
  │   /container/export  │                 │
  │   /{id}?abc123 ─────>│                 │
  │                      ├─ Get param 'id' │
  │                      │ from env.http   │
  │                      │                 │
  │                      ├─ Create socket  │
  │                      │                 │
  │                      ├─ Connect to     │
  │                      │ /var/run/       │
  │                      │ docker.sock ────>
  │                      │                 │
  │                      │ <─ HTTP 200 OK  │
  │                      │                 │
  │                      │ <─ tar chunk 1  │
  │                      │ <─ tar chunk 2  │
  │ <─ HTTP 200 OK ──────│ <─ tar chunk 3  │
  │ <─ tar chunk 1 ──────│ <─ ...          │
  │ <─ tar chunk 2 ──────│ <─ EOF          │
  │ <─ ...               │                 │
  │                      │                 │
  ├─ Done                │                 │
  │                      ├─ Close socket   │
  │                      │                 │
```


## Socket Connection Details

```
┌──────────────────────────────────────┐
│     UHTTPd (Web Server)              │
│  [Controller Process]                │
└─────────────┬────────────────────────┘
              │
              │ AF_UNIX socket
              │ (named pipe)
              V
┌──────────────────────────────────────┐
│     Docker Daemon                    │
│  /var/run/docker.sock                │
└─────────────┬────────────────────────┘
              │
              │ HTTP Protocol
              │ (over socket)
              V
      Docker API Engine
      - Creates export tar
      - Sends as chunked stream
```
