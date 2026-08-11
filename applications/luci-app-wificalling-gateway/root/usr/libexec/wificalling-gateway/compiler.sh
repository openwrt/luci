#!/bin/sh
set -eu

input=${1:?normalized configuration required}
output=${2:?output path required}
tmp="${output}.tmp.$$"
trap 'rm -f "$tmp"' EXIT HUP INT TERM

awk -F '|' '
function esc(s,    x) { x=s; gsub(/\\/, "\\\\", x); gsub(/\"/, "\\\"", x); gsub(/\r/, "\\r", x); gsub(/\n/, "\\n", x); return x }
function q(s) { return "\"" esc(s) "\"" }
function fail(s) { print "wificalling-gateway: " s > "/dev/stderr"; exit 2 }
function private4(ip, a) {
  if (ip !~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) return 0
  split(ip,a,"."); if (a[1]>255||a[2]>255||a[3]>255||a[4]>255) return 0
  return a[1]==10 || (a[1]==172 && a[2]>=16 && a[2]<=31) || (a[1]==192 && a[2]==168)
}
function tls(sni, insecure, alpn, pin, extra) {
  extra="\"enabled\":true"
  if (sni!="") extra=extra ",\"server_name\":" q(sni)
  extra=extra ",\"insecure\":" (insecure=="1"?"true":"false")
  if (alpn!="") extra=extra ",\"alpn\":[" q(alpn) "]"
  if (pin!="") extra=extra ",\"certificate_public_key_sha256\":[" q(pin) "]"
  return "{" extra "}"
}
$1=="global" { if ($2=="log_level") level=$3; if ($2=="wireguard_style") wg_style=$3; next }
$1=="node" {
  id=$2; proto=$3
  if (id=="" || seen_node[id]++) fail("duplicate or empty node id: " id)
  if (proto!="anytls" && proto!="hysteria2" && proto!="tuic" && proto!="vless" && proto!="vmess" && proto!="trojan" && proto!="wireguard") fail("unsupported protocol: " proto)
  if ($4=="" || $5 !~ /^[0-9]+$/ || $5<1 || $5>65535) fail("invalid server or port for node: " id)
  node[++nn]=$0; node_id[nn]=id; node_proto[id]=proto
  if (proto=="wireguard") wg_nodes[++nw]=nn
  next
}
$1=="device" {
  if (!node_proto[$3]) fail("device references unknown node: " $3)
  n=split($4, ips, ","); if (n<1 || $4=="") fail("device has no client IP: " $2)
  normalized=""
  for(i=1;i<=n;i++) {
    ip=ips[i]; gsub(/^[ \t]+|[ \t]+$/, "", ip)
    if (!private4(ip)) fail("client IP must be private IPv4: " ip)
    if (owner[ip] && owner[ip]!=$2) fail("duplicate client IP assignment: " ip)
    owner[ip]=$2; normalized=normalized (normalized?",":"") ip
  }
  dev[++nd]=$2; devnode[nd]=$3; devips[nd]=normalized; next
}
END {
  if (nn<1) fail("at least one enabled node is required")
  if (level=="") level="warn"
  if (wg_style=="") wg_style="legacy"
  print "{"
  # The wireguard outbound was removed in sing-box 1.13.0 (deprecated in
  # 1.11.0, gated behind ENABLE_DEPRECATED_WIREGUARD_OUTBOUND on 1.11/1.12);
  # the wireguard endpoint works from 1.11.0 on.  init.d picks the style from
  # the installed sing-box version; "endpoint" emits an endpoints block and
  # routes straight to the endpoint tag, "legacy" keeps the old outbound.
  if (nw>0 && wg_style=="endpoint") {
    print "  \"endpoints\":["
    for(w=1;w<=nw;w++) {
      split(node[wg_nodes[w]],f,"|"); id=f[2]
      s="{\"type\":\"wireguard\",\"tag\":" q("wg-" id) ",\"address\":[" q(f[22]) "],\"private_key\":" q(f[21])
      s=s ",\"peers\":[{\"address\":" q(f[4]) ",\"port\":" f[5] ",\"public_key\":" q(f[13]) ",\"allowed_ips\":[\"0.0.0.0/0\"]"
      if (f[23]!="") { nr=split(f[23],rv,","); rv_s=rv[1]; for(ri=2;ri<=nr;ri++) rv_s=rv_s "," rv[ri]; s=s ",\"reserved\":[" rv_s "]" }
      s=s "}]"
      if (f[24]!="") s=s ",\"mtu\":" f[24]
      s=s "}"; print "    " s (w<nw?",":"")
    }
    print "  ],"
  }
  print "  \"log\":{\"level\":" q(level) ",\"timestamp\":true},"
  print "  \"inbounds\":[{\"type\":\"tproxy\",\"tag\":\"wfc-tcp\",\"listen\":\"0.0.0.0\",\"listen_port\":11441,\"network\":\"tcp\"},{\"type\":\"tproxy\",\"tag\":\"wfc-udp\",\"listen\":\"0.0.0.0\",\"listen_port\":11442,\"network\":\"udp\"}],"
  print "  \"outbounds\":["
  for(k=1;k<=nn;k++) {
    split(node[k],f,"|"); id=f[2]; p=f[3]
    if (p=="wireguard" && wg_style=="endpoint") continue
    s="{\"type\":" q(p) ",\"tag\":" q("node-" id) ",\"server\":" q(f[4]) ",\"server_port\":" f[5]
    if (p=="anytls") s=s ",\"password\":" q(f[6]) ",\"tls\":" tls(f[7],f[8],f[9],f[20])
    if (p=="hysteria2") s=s ",\"password\":" q(f[6]) ",\"tls\":" tls(f[7],f[8],f[9],f[20])
    if (p=="tuic") s=s ",\"uuid\":" q(f[10]) ",\"password\":" q(f[6]) ",\"congestion_control\":" q(f[11]?f[11]:"bbr") ",\"udp_relay_mode\":" q(f[12]?f[12]:"native") ",\"tls\":" tls(f[7],f[8],f[9],f[20])
    if (p=="vless") {
      s=s ",\"uuid\":" q(f[6])
      if (f[10]!="") s=s ",\"flow\":" q(f[10])
      if (f[16]=="reality") s=s ",\"tls\":{\"enabled\":true,\"server_name\":" q(f[7]) ",\"reality\":{\"enabled\":true,\"public_key\":" q(f[13]) ",\"short_id\":" q(f[14]) "},\"utls\":{\"enabled\":true,\"fingerprint\":" q(f[15]?f[15]:"chrome") "}}"
      # TLS is decided by security/sni alone; only the server_name falls
      # back to the WS Host (f[19]) when sni (f[7]) is empty, so a plain
      # ws node with a Host header but no TLS never gains a tls block.
      else if (f[16]=="tls"||f[7]!="") s=s ",\"tls\":" tls((f[7]!=""?f[7]:f[19]),f[8],f[9],f[20])
    }
    if (p=="vmess") {
      s=s ",\"uuid\":" q(f[6]) ",\"security\":\"auto\",\"alter_id\":" (f[10]~/^[0-9]+$/?f[10]:0)
      if (f[17]=="ws") s=s ",\"transport\":{\"type\":\"ws\",\"path\":" q(f[18]) ",\"headers\":{\"Host\":" q(f[19]) "}}"
      # Imported VMess links carry the TLS name in the WS Host (f[19]) when
      # sni (f[7]) is empty and the server is a bare IP; fall back to it so
      # certificate verification has a name to check.  Plain ws nodes with
      # a Host header but no TLS stay cleartext.
      if (f[16]=="tls"||f[7]!="") s=s ",\"tls\":" tls((f[7]!=""?f[7]:f[19]),f[8],f[9],f[20])
    }
    if (p=="trojan") s=s ",\"password\":" q(f[6]) ",\"tls\":" tls(f[7],f[8],f[9],f[20])
    if (p=="wireguard") {
      # Legacy wireguard outbound (sing-box < 1.11).  The endpoint form above
      # is preferred; this branch uses the singular field name the old
      # outbound actually parsed (local_address, not local_addresses).
      s=s ",\"private_key\":" q(f[21]) ",\"peer_public_key\":" q(f[13]) ",\"local_address\":[" q(f[22]) "]"
      if (f[23]!="") { nr=split(f[23],rv,","); rv_s=rv[1]; for(ri=2;ri<=nr;ri++) rv_s=rv_s "," rv[ri]; s=s ",\"reserved\":[" rv_s "]" }
      if (f[24]!="") s=s ",\"mtu\":" f[24]
    }
    s=s "}"; print "    " s ","
  }
  print "    {\"type\":\"direct\",\"tag\":\"direct\"}"
  print "  ],"
  print "  \"route\":{\"auto_detect_interface\":true,\"final\":\"direct\",\"rules\":["
  print "    {\"ip_is_private\":true,\"action\":\"route\",\"outbound\":\"direct\"}" (nd?",":"")
  for(k=1;k<=nd;k++) {
    n=split(devips[k],ips,","); list=""
    for(i=1;i<=n;i++) list=list (list?",":"") q(ips[i] "/32")
    out=(node_proto[devnode[k]]=="wireguard" && wg_style=="endpoint") ? "wg-" devnode[k] : "node-" devnode[k]
    print "    {\"source_ip_cidr\":[" list "],\"action\":\"route\",\"outbound\":" q(out) "}" (k<nd?",":"")
  }
  print "  ]}}"
}
' "$input" > "$tmp" || exit $?
chmod 600 "$tmp"
mv "$tmp" "$output"
trap - EXIT HUP INT TERM
