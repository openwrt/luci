-- LuCI controller for mitmproxy
-- Provides routing for all mitmproxy LuCI pages and their JSON endpoints.
--
-- Runs on OpenWrt's BusyBox userland: no curl, no "ps -p/-o", and BusyBox
-- regexes are POSIX ERE, so everything below sticks to /proc, wget and ERE.

module("luci.controller.mitmproxy", package.seeall)

function index()
    entry({"admin", "services", "mitmproxy"}, alias("admin", "services", "mitmproxy", "status"),
          _("mitmproxy"), 60).dependent = false

    entry({"admin", "services", "mitmproxy", "status"}, template("mitmproxy/status"),
          _("Status"), 10).leaf = true
    entry({"admin", "services", "mitmproxy", "settings"}, cbi("mitmproxy/settings"),
          _("Settings"), 20).leaf = true
    entry({"admin", "services", "mitmproxy", "rules"}, cbi("mitmproxy/rules"),
          _("Rules"), 30).leaf = true
    entry({"admin", "services", "mitmproxy", "alerts"}, template("mitmproxy/alerts"),
          _("Alerts"), 40).leaf = true
    entry({"admin", "services", "mitmproxy", "traffic"}, template("mitmproxy/traffic"),
          _("Traffic Analysis"), 50).leaf = true

    -- Read-only JSON endpoints
    entry({"admin", "services", "mitmproxy", "api", "status"}, call("api_status")).leaf = true
    entry({"admin", "services", "mitmproxy", "api", "alerts"}, call("api_alerts")).leaf = true
    entry({"admin", "services", "mitmproxy", "api", "flows"}, call("api_flows")).leaf = true
    entry({"admin", "services", "mitmproxy", "api", "stats"}, call("api_stats")).leaf = true
    -- State-changing endpoint: post() makes LuCI require POST + the CSRF token
    entry({"admin", "services", "mitmproxy", "api", "action"}, post("api_action")).leaf = true
end

local function read_file(path)
    local f = io.open(path, "r")
    if not f then return nil end
    local data = f:read("*a")
    f:close()
    return data
end

local function write_json(obj)
    local http = require "luci.http"
    local json = require "luci.jsonc"
    http.prepare_content("application/json")
    http.write(json.stringify(obj))
end

-- PID of the mitmweb process. procd is the source of truth (it started the
-- process); fall back to ps if ubus gives no answer.
local function mitm_pid()
    local util = require "luci.util"
    local svc = util.ubus("service", "list", { name = "mitmproxy" })
    local inst = svc and svc.mitmproxy and svc.mitmproxy.instances
        and svc.mitmproxy.instances.mitmproxy
    if inst then
        return (inst.running and inst.pid) and tostring(inst.pid) or nil
    end
    -- The launchers run "python3 -c '... from mitmproxy.tools.main import ...'";
    -- "[m]" keeps grep from matching the shell running this pipeline.
    local sys = require "luci.sys"
    local out = sys.exec("ps w | grep '[p]ython3 -c .*mitmproxy[.]tools[.]main' | awk '{print $1}' | head -n 1")
    return out:match("^%s*(%d+)%s*$")
end

-- Fetch a mitmweb API path with the configured token. Returns the body or nil.
local function mitmweb_get(path)
    local sys = require "luci.sys"
    local util = require "luci.util"
    local uci = require "luci.model.uci".cursor()
    local port = tonumber(uci:get("mitmproxy", "main", "web_port")) or 8081
    local token = uci:get("mitmproxy", "main", "web_password") or ""
    local url = string.format("http://127.0.0.1:%d%s", port, path)
    -- OpenWrt's wget is usually uclient-fetch, which has no --header option,
    -- so pass the token as the query parameter mitmweb also accepts.
    token = token:gsub("[^%w%-%._~]", function(c) return string.format("%%%02X", c:byte()) end)
    url = url .. (url:find("?", 1, true) and "&" or "?") .. "token=" .. token
    local body = sys.exec(string.format("wget -q -T 3 -O - %s 2>/dev/null", util.shellquote(url)))
    if body == nil or body == "" then return nil end
    return body
end

-- ── API: Service Status ──────────────────────────────────────────────

function api_status()
    local uci = require "luci.model.uci".cursor()
    local json = require "luci.jsonc"
    local status = {}

    local pid = mitm_pid()
    status.running = (pid ~= nil)
    status.pid = pid or ""

    status.memory_mb = "0.0"
    status.uptime = "N/A"
    if pid then
        local st = read_file("/proc/" .. pid .. "/status") or ""
        local rss_kb = tonumber(st:match("VmRSS:%s*(%d+)")) or 0
        status.memory_mb = string.format("%.1f", rss_kb / 1024)

        -- /proc/<pid>/stat field 22 = start time in clock ticks (USER_HZ 100).
        -- Fields are counted after the ")" that closes the command name.
        local stat = read_file("/proc/" .. pid .. "/stat") or ""
        local fields = {}
        for f in (stat:match("%)%s+(.*)") or ""):gmatch("%S+") do fields[#fields + 1] = f end
        local start_ticks = tonumber(fields[20])
        local sys_up = tonumber((read_file("/proc/uptime") or ""):match("^(%S+)"))
        if start_ticks and sys_up then
            local secs = math.max(0, math.floor(sys_up - start_ticks / 100))
            status.uptime = string.format("%dh %dm %ds",
                math.floor(secs / 3600), math.floor(secs % 3600 / 60), secs % 60)
        end
    end

    -- System memory from /proc/meminfo (kB) reported in MB
    local mi = read_file("/proc/meminfo") or ""
    local total = (tonumber(mi:match("MemTotal:%s*(%d+)")) or 0) / 1024
    local avail = (tonumber(mi:match("MemAvailable:%s*(%d+)")) or 0) / 1024
    local used = total - avail
    status.sys_mem = {
        total = math.floor(total),
        used = math.floor(used),
        available = math.floor(avail),
        percent = total > 0 and math.floor(used / total * 100) or 0,
    }

    status.enabled = uci:get("mitmproxy", "main", "enabled") == "1"
    status.listen_port = uci:get("mitmproxy", "main", "listen_port") or "8080"
    status.web_port = uci:get("mitmproxy", "main", "web_port") or "8081"
    status.mode = uci:get("mitmproxy", "main", "mode") or "regular"
    -- The LuCI admin is already root on this router; give the page what it
    -- needs to build the mitmweb link.
    status.web_token = uci:get("mitmproxy", "main", "web_password") or ""

    status.flow_count = 0
    if pid then
        local flows = json.parse(mitmweb_get("/flows") or "")
        if type(flows) == "table" then status.flow_count = #flows end
    end

    -- Error lines in the system log from the service: Python tracebacks
    -- (procd logs stderr as daemon.err) and init-script errors. mitmproxy's
    -- own log goes to stdout without a level, so it is logged as daemon.info.
    local sys = require "luci.sys"
    local cnt = sys.exec("logread 2>/dev/null | grep -cE ' daemon[.](err|crit|alert|emerg) mitm(web|dump|proxy)(\\[[0-9]+\\])?: '")
    status.alert_count = tonumber(cnt:match("(%d+)")) or 0

    status.loadavg = (read_file("/proc/loadavg") or ""):match("^(%S+)") or "0.00"

    write_json(status)
end

-- ── API: Alerts / Logs ───────────────────────────────────────────────

function api_alerts()
    local sys = require "luci.sys"
    local alerts = {}

    -- Last 50 log lines written by the service (procd tags them with the
    -- program name) or by the init script (logger -t mitmproxy).
    local log_output = sys.exec(
        "logread 2>/dev/null | grep -E ' mitm(web|dump|proxy)(\\[[0-9]+\\])?: ' | tail -n 50")

    local i = 0
    for line in log_output:gmatch("[^\n]+") do
        i = i + 1
        -- "Mon Oct  5 00:46:42 2026 daemon.err mitmweb[11556]: message"
        local ts, prio, msg = line:match("^(%a+ +%a+ +%d+ [%d:]+ %d+) (%S+) (.*)$")
        if not ts then ts, prio, msg = "", "", line end
        local level = prio:match("%.(%a+)$") or ""
        local severity = "info"
        if level == "err" or level == "crit" or level == "emerg" then
            severity = "error"
        elseif level == "alert" then
            severity = "alert"
        elseif level == "warn" then
            severity = "warning"
        end
        alerts[#alerts + 1] = {
            id = i, timestamp = ts, severity = severity, message = msg, source = "syslog",
        }
    end

    local reversed = {}
    for j = #alerts, 1, -1 do reversed[#reversed + 1] = alerts[j] end
    write_json({ alerts = reversed, total = #reversed })
end

-- ── API: Traffic Flows ───────────────────────────────────────────────

function api_flows()
    local http = require "luci.http"
    local json = require "luci.jsonc"
    local body = mitm_pid() and mitmweb_get("/flows")
    if body and type(json.parse(body)) == "table" then
        http.prepare_content("application/json")
        http.write(body)
    else
        write_json({ flows = {}, error = "mitmweb not available" })
    end
end

-- ── API: Statistics ──────────────────────────────────────────────────

function api_stats()
    local stats = {}
    local function num(path) return tonumber((read_file(path) or ""):match("(%d+)")) end

    stats.rx_bytes = num("/sys/class/net/br-lan/statistics/rx_bytes") or 0
    stats.tx_bytes = num("/sys/class/net/br-lan/statistics/tx_bytes") or 0
    stats.rx_mb = string.format("%.1f", stats.rx_bytes / 1048576)
    stats.tx_mb = string.format("%.1f", stats.tx_bytes / 1048576)
    stats.connections = num("/proc/sys/net/netfilter/nf_conntrack_count") or 0
    stats.connections_max = num("/proc/sys/net/netfilter/nf_conntrack_max") or 0
    local temp = num("/sys/class/thermal/thermal_zone0/temp")
    stats.cpu_temp = temp and string.format("%.1f", temp / 1000) or "N/A"

    write_json(stats)
end

-- ── API: Service Actions ─────────────────────────────────────────────

function api_action()
    local http = require "luci.http"
    local uci = require "luci.model.uci".cursor()
    local action = http.formvalue("action")

    local function set_enabled(v)
        uci:set("mitmproxy", "main", "enabled", v)
        uci:commit("mitmproxy")
    end
    local function run(cmd) return os.execute(cmd .. " >/dev/null 2>&1") == 0 end

    local ok, message
    if action == "start" then
        -- The init script only starts the service when main.enabled=1.
        set_enabled("1")
        ok = run("/etc/init.d/mitmproxy start")
        message = "mitmproxy starting (first start can take up to a minute)"
    elseif action == "stop" then
        ok = run("/etc/init.d/mitmproxy stop")
        message = "mitmproxy stopped"
    elseif action == "restart" then
        set_enabled("1")
        ok = run("/etc/init.d/mitmproxy restart")
        message = "mitmproxy restarting"
    elseif action == "enable" then
        set_enabled("1")
        ok = run("/etc/init.d/mitmproxy enable")
        message = "mitmproxy will start at boot"
    elseif action == "disable" then
        ok = run("/etc/init.d/mitmproxy disable")
        message = "mitmproxy will not start at boot"
    else
        ok, message = false, "Unknown action"
    end

    write_json({ success = ok, message = ok and message or ("Failed: " .. message) })
end
