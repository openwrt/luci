/*
 * Traffic analysis for the mitmproxy LuCI app.
 *
 * Works on the flow list that mitmweb returns from /flows (the same JSON its
 * own UI uses) and runs in the browser, so it costs the router nothing.
 * Everything here is computed from the flows mitmweb currently holds:
 * request line, headers, sizes, timing, client address and the upstream TLS
 * certificate. Request and response bodies are not part of that list and are
 * not inspected. The checks are fixed heuristics with the thresholds below.
 */
(function (root) {
    'use strict';

    var T = {
        volumePerMinute: 120,       // requests to one host within 60 s
        beaconMinRequests: 6,       // requests from one client to one host
        beaconMinInterval: 2,       // seconds; faster than this is ordinary browsing
        beaconMaxCv: 0.2,           // stddev / mean of the gaps between requests
        uploadSingle: 5 * 1048576,  // one request body
        uploadTotal: 20 * 1048576,  // one client to one host, all requests
        errorMinRequests: 10,
        errorRatio: 0.5,
        maxFindings: 20
    };

    var WEAK_TLS = { 'SSLv2': 1, 'SSLv3': 1, 'TLSv1': 1, 'TLSv1.1': 1 };
    var RISKY_TYPES = /^application\/(x-msdownload|x-msdos-program|x-dosexec|x-ms-installer|x-msi|vnd\.microsoft\.portable-executable|x-sh|x-elf|x-executable|vnd\.android\.package-archive|java-archive|x-java-archive)\b/i;
    var RISKY_EXT = /\.(exe|dll|scr|msi|bat|cmd|ps1|vbs|jar|apk|elf|sh|bin)$/i;

    var RULES = [
        { id: 'log4shell', name: 'Log4Shell / JNDI lookup', severity: 'critical',
          re: /\$\{\s*(jndi|env|sys|lower|upper|::-)[^}]{0,200}\}?/i },
        { id: 'sqli', name: 'SQL injection pattern', severity: 'critical',
          re: /(\bunion\s+(all\s+)?select\b|\b(or|and)\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+|\bsleep\s*\(\s*\d|\bbenchmark\s*\(|\bwaitfor\s+delay\b|'\s*(--|#|;)|\bdrop\s+table\b|\binformation_schema\b)/i },
        { id: 'cmdi', name: 'Command injection pattern', severity: 'critical',
          re: /(;|\|\|?|&&|`|\$\()\s*(cat|ls|id|whoami|uname|wget|curl|nc|ncat|bash|sh|python[23]?|perl|powershell)\b/i },
        { id: 'traversal', name: 'Path traversal', severity: 'warning',
          re: /(\.\.[\/\\]|%2e%2e(%2f|%5c|\/|\\)|\/etc\/(passwd|shadow)|\bwin\.ini\b)/i },
        { id: 'xss', name: 'Cross-site scripting pattern', severity: 'warning',
          re: /(<\s*script\b|javascript\s*:|\bon(error|load|mouseover|focus)\s*=|<\s*(svg|img|iframe)\b[^>]*\bon\w+\s*=)/i },
        { id: 'cleartext', name: 'Credentials over plain HTTP', severity: 'warning', re: null }
    ];

    function header(headers, name) {
        name = name.toLowerCase();
        for (var i = 0; headers && i < headers.length; i++)
            if (String(headers[i][0]).toLowerCase() === name) return String(headers[i][1]);
        return null;
    }

    function decode(s) {
        s = String(s || '').replace(/\+/g, ' ');
        for (var i = 0; i < 2; i++) {          // catch double encoding once
            try { var d = decodeURIComponent(s); if (d === s) break; s = d; }
            catch (e) { break; }
        }
        return s;
    }

    function clientOf(f) {
        var p = f.client_conn && f.client_conn.peername;
        return p ? String(p[0]).replace(/^::ffff:/, '') : '?';
    }

    function hostOf(f) {
        var r = f.request || {};
        return String(r.pretty_host || r.host || (f.server_conn && f.server_conn.address && f.server_conn.address[0]) || '?');
    }

    function nameMatches(name, pattern) {
        name = String(name).toLowerCase(); pattern = String(pattern).toLowerCase();
        if (pattern === name) return true;
        if (pattern.indexOf('*.') === 0) {
            var suffix = pattern.substring(1);
            var head = name.substring(0, name.length - suffix.length);
            return name.length > suffix.length && name.slice(-suffix.length) === suffix && head.indexOf('.') < 0;
        }
        return false;
    }

    function sameName(a, b) { return JSON.stringify(a || []) === JSON.stringify(b || []); }

    function finding(list, text, severity) {
        if (list.length < T.maxFindings) list.push({ text: text, severity: severity || 'warning' });
        return list;
    }

    function check(id, title, desc, findings, enoughData, noDataText) {
        var status = 'ok';
        if (!enoughData) status = 'nodata';
        else if (findings.some(function (f) { return f.severity === 'critical'; })) status = 'critical';
        else if (findings.length) status = 'warning';
        return { id: id, title: title, desc: desc, status: status, findings: findings,
                 noDataText: noDataText || 'Not enough traffic yet' };
    }

    function analyze(flows, now) {
        now = now || Date.now() / 1000;
        var o = { total: 0, http: 0, https: 0, ws: 0, other: 0, failed: 0,
                  s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, methods: {}, hosts: {}, clients: {},
                  bytesDown: 0, bytesUp: 0, first: null, last: null };
        var pairs = {};            // client|host -> {up}
        var series = {};           // client|host|path -> {times:[]}
        var hostTimes = {};        // host -> [timestamps]
        var tlsFindings = [], tlsSeen = {}, httpsFlows = 0;
        var downloads = [], uploads = [], matches = [];
        var ruleCounts = {};
        RULES.forEach(function (r) { ruleCounts[r.id] = 0; });

        (flows || []).forEach(function (f) {
            o.total++;
            var req = f.request || {}, resp = f.response || null;
            var host = hostOf(f), client = clientOf(f);
            var ts = req.timestamp_start || f.timestamp_created || 0;
            if (ts) {
                o.first = o.first === null ? ts : Math.min(o.first, ts);
                o.last = o.last === null ? ts : Math.max(o.last, ts);
            }

            if (f.type !== 'http') o.other++;
            else if (f.websocket) o.ws++;
            else if (req.scheme === 'https') o.https++;
            else o.http++;

            var up = req.contentLength || 0, down = resp ? (resp.contentLength || 0) : 0;
            o.bytesUp += up; o.bytesDown += down;

            var method = String(req.method || f.type || '?').toUpperCase();
            o.methods[method] = (o.methods[method] || 0) + 1;

            var code = resp ? resp.status_code : 0;
            if (f.type !== 'http') { /* TCP/UDP/DNS flows have no HTTP status */ }
            else if (!resp) o.failed++;
            else if (code < 300) o.s2xx++;
            else if (code < 400) o.s3xx++;
            else if (code < 500) o.s4xx++;
            else o.s5xx++;

            var h = o.hosts[host] || (o.hosts[host] = { count: 0, bytes: 0, up: 0, errors: 0, clients: {} });
            h.count++; h.bytes += down; h.up += up; h.clients[client] = 1;
            if (f.type === 'http' && (!resp || code >= 400)) h.errors++;
            var c = o.clients[client] || (o.clients[client] = { count: 0, bytes: 0, hosts: {} });
            c.count++; c.bytes += down + up; c.hosts[host] = 1;

            if (f.type !== 'http') return;

            // per pair / per host timing
            var key = client + '|' + host;
            var p = pairs[key] || (pairs[key] = { client: client, host: host, up: 0 });
            p.up += up;
            var path = String(req.path || '/').split('?')[0];
            var sk = key + '|' + path;
            var sr = series[sk] || (series[sk] = { client: client, host: host, path: path, times: [] });
            if (ts) sr.times.push(ts);
            if (ts) (hostTimes[host] || (hostTimes[host] = [])).push(ts);

            if (up > T.uploadSingle)
                finding(uploads, client + ' sent ' + mb(up) + ' to ' + host + req.path.split('?')[0]);

            // upstream TLS
            var sc = f.server_conn || {};
            if (req.scheme === 'https') httpsFlows++;
            if (sc.tls_established || sc.cert) {
                var problems = [];
                var cert = sc.cert;
                if (cert) {
                    if (cert.notafter && cert.notafter < now) problems.push('certificate expired ' + new Date(cert.notafter * 1000).toISOString().slice(0, 10));
                    if (cert.notbefore && cert.notbefore > now) problems.push('certificate not valid yet');
                    if (sameName(cert.subject, cert.issuer)) problems.push('self-signed certificate');
                    var sni = sc.sni || host;
                    if (sni && !/^[\d.:]+$/.test(sni)) {
                        var names = (cert.altnames || []).slice();
                        (cert.subject || []).forEach(function (kv) { if (kv[0] === 'CN') names.push(kv[1]); });
                        if (names.length && !names.some(function (n) { return nameMatches(sni, n); }))
                            problems.push('certificate does not cover ' + sni);
                    }
                }
                if (sc.tls_version && WEAK_TLS[sc.tls_version]) problems.push('outdated protocol ' + sc.tls_version);
                problems.forEach(function (pr) {
                    if (!tlsSeen[host + pr]) { tlsSeen[host + pr] = 1; finding(tlsFindings, host + ': ' + pr); }
                });
            }
            if (f.error && /certificate|tls|ssl|handshake/i.test(f.error.msg || '')) {
                var msg = String(f.error.msg).slice(0, 160);
                if (!tlsSeen[host + msg]) { tlsSeen[host + msg] = 1; finding(tlsFindings, host + ': ' + msg); }
            }

            // risky downloads
            if (resp) {
                var ctype = header(resp.headers, 'content-type') || '';
                var disp = header(resp.headers, 'content-disposition') || '';
                var fname = (disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i) || [])[1] || req.path.split('?')[0];
                if (RISKY_TYPES.test(ctype) || (code < 300 && RISKY_EXT.test(decode(fname))))
                    finding(downloads, client + ' downloaded ' + host + req.path.split('?')[0].slice(0, 80) +
                            ' (' + (ctype || 'no content-type') + ', ' + mb(down) + ')');
            }

            // signature rules on the request line and header values
            var target = decode(req.path);
            var hdrText = (req.headers || []).map(function (kv) {
                return kv[0].toLowerCase() === 'cookie' ? '' : String(kv[1]).slice(0, 2048);
            }).join('\n');
            var hit = {};
            RULES.forEach(function (r) {
                if (!r.re) return;
                var m = r.re.exec(target) || r.re.exec(decode(hdrText));
                if (m) hit[r.id] = m[0];
            });
            if (req.scheme === 'http') {
                var auth = header(req.headers, 'authorization') || '';
                if (/^basic\s/i.test(auth)) hit.cleartext = 'Authorization: Basic';
                else if (/[?&](pass(word)?|passwd|pwd|token|api_?key|secret)=[^&]/i.test(req.path))
                    hit.cleartext = 'credential in URL';
            }
            Object.keys(hit).forEach(function (id) {
                ruleCounts[id]++;
                var rule = RULES.filter(function (r) { return r.id === id; })[0];
                if (matches.length < 200)
                    matches.push({ time: ts, client: client, rule: rule.name, severity: rule.severity,
                                   method: method, url: req.scheme + '://' + host + req.path,
                                   evidence: String(hit[id]).slice(0, 80) });
            });
        });

        // request volume: busiest 60 s window per host
        var volume = [], maxRate = 0;
        Object.keys(hostTimes).forEach(function (host) {
            var t = hostTimes[host].sort(function (a, b) { return a - b; }), j = 0, best = 0;
            for (var i = 0; i < t.length; i++) {
                while (t[i] - t[j] > 60) j++;
                best = Math.max(best, i - j + 1);
            }
            maxRate = Math.max(maxRate, best);
            if (best >= T.volumePerMinute)
                finding(volume, host + ': ' + best + ' requests within one minute (' + t.length + ' total)');
        });

        // beaconing: one client requesting the same URL path at a steady interval
        var beacons = [], beaconCandidates = 0;
        Object.keys(series).forEach(function (k) {
            var p = series[k], t = p.times.sort(function (a, b) { return a - b; });
            if (t.length < T.beaconMinRequests) return;
            beaconCandidates++;
            var gaps = [];
            for (var i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
            var mean = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
            if (mean < T.beaconMinInterval) return;
            var sd = Math.sqrt(gaps.reduce(function (a, g) { return a + (g - mean) * (g - mean); }, 0) / gaps.length);
            var cv = sd / mean;
            if (cv <= T.beaconMaxCv)
                finding(beacons, p.client + ' → ' + p.host + p.path.slice(0, 60) + ': ' + t.length +
                        ' requests every ~' + fmtSecs(mean) + ' (±' + Math.round(cv * 100) + '%)');
        });

        // large uploads in total, per client and host
        Object.keys(pairs).forEach(function (k) {
            var p = pairs[k];
            if (p.up > T.uploadTotal)
                finding(uploads, p.client + ' sent ' + mb(p.up) + ' in total to ' + p.host);
        });

        // hosts that mostly fail
        var errors = [];
        Object.keys(o.hosts).forEach(function (host) {
            var h = o.hosts[host];
            if (h.count >= T.errorMinRequests && h.errors / h.count >= T.errorRatio)
                finding(errors, host + ': ' + h.errors + ' of ' + h.count + ' requests failed or returned 4xx/5xx');
        });

        var httpTotal = o.http + o.https + o.ws;
        var checks = [
            check('volume', 'Request volume',
                  'Flags a host that received ' + T.volumePerMinute + ' or more requests within one minute. Busiest host so far: ' + maxRate + ' per minute.',
                  volume, httpTotal > 0),
            check('beacon', 'Periodic connections (beaconing)',
                  'Flags a client that requests the same URL at a steady interval (at least ' + T.beaconMinRequests +
                  ' requests, ' + T.beaconMinInterval + ' s or more apart, timing variation within ' + Math.round(T.beaconMaxCv * 100) +
                  '%). Malware check-ins look like this, but so do update checks and keep-alives.',
                  beacons, beaconCandidates > 0, 'No client has requested one URL ' + T.beaconMinRequests + ' times yet'),
            check('tls', 'Upstream TLS problems',
                  'Checks the certificates of the servers mitmproxy connected to: expired, not yet valid, self-signed, wrong name, or a protocol older than TLS 1.2. Also lists failed TLS handshakes.',
                  tlsFindings, httpsFlows > 0 || tlsFindings.length > 0, 'No HTTPS traffic intercepted yet'),
            check('upload', 'Large uploads',
                  'Flags a single request body over ' + mb(T.uploadSingle) + ', or over ' + mb(T.uploadTotal) +
                  ' in total from one client to one host. Uploads can be legitimate (backups, cloud sync).',
                  uploads, httpTotal > 0),
            check('download', 'Executable downloads',
                  'Flags responses whose Content-Type or file name marks them as a program or script (.exe, .msi, .apk, .ps1, .sh, ...).',
                  downloads, httpTotal > 0),
            check('errors', 'Hosts that mostly fail',
                  'Flags a host with at least ' + T.errorMinRequests + ' requests where ' + Math.round(T.errorRatio * 100) +
                  '% or more failed or returned 4xx/5xx. Typical of scanning, blocked services or broken apps.',
                  errors, httpTotal > 0)
        ];

        return { overview: o, checks: checks, matches: matches, ruleCounts: ruleCounts, rules: RULES,
                 thresholds: T };
    }

    function mb(b) {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1048576).toFixed(1) + ' MB';
    }

    function fmtSecs(s) {
        if (s < 120) return Math.round(s) + ' s';
        if (s < 7200) return Math.round(s / 60) + ' min';
        return (s / 3600).toFixed(1) + ' h';
    }

    var api = { analyze: analyze, formatBytes: mb, thresholds: T, rules: RULES };
    root.MitmAnalysis = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
