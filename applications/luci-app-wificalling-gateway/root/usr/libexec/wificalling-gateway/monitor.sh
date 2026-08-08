#!/bin/sh
set -eu

clients=${1:?client map required}
conntrack=${2:-/proc/net/nf_conntrack}
output=${3:-/var/run/wificalling-gateway/status.json}
output_dir=${output%/*}
[ "$output_dir" != "$output" ] || output_dir=.
state=${4:-$output_dir/monitor.state}
events=${5:-$output_dir/events.log}
event_interval=${6:-60}
max_events=${7:-20}
log_enabled=${8:-1}
tmp="${output}.tmp.$$"
state_tmp="${state}.tmp.$$"
event_tmp="${events}.tmp.$$"
trim_tmp="${events}.trim.$$"
trap 'rm -f "$tmp" "$state_tmp" "$event_tmp" "$trim_tmp"' EXIT HUP INT TERM

now=${WFC_NOW:-$(date +%s)}
touch "$state" "$events"
: > "$state_tmp"
: > "$event_tmp"

awk -F '|' -v now="$now" -v clients_file="$clients" -v conntrack_file="$conntrack" \
	-v state_file="$state" -v state_out="$state_tmp" -v event_out="$event_tmp" -v event_interval="$event_interval" -v log_enabled="$log_enabled" '
function q(s, x) { x=s; gsub(/\\/,"\\\\",x); gsub(/\"/,"\\\"",x); return "\"" x "\"" }
FILENAME==clients_file {
  if ($1!="" && $2!="") { n++; label[n]=$1; ip[n]=$2; node[n]=$3; index_by_ip[$2]=n }
  next
}
FILENAME==state_file {
  i=index_by_ip[$2]
  if (i) {
		old_wfc[i]=$3; old_sent[i]=$4+0; old_reply[i]=$5+0; old_last[i]=$6+0
		old_event[i]=$7+0; old_streak[i]=$8+0; old_acc_sent[i]=$9+0; old_acc_reply[i]=$10+0
		old_traffic_since[i]=($11!="" ? $11+0 : 0)
  }
  next
}
FILENAME==conntrack_file {
  line=$0
  for (i=1;i<=n;i++) {
    if (line !~ ("src=" ip[i] " ")) continue
    if (match(line,/dst=[0-9.]+/)) dst=substr(line,RSTART+4,RLENGTH-4)
    is500=(line ~ /dport=500 /); is4500=(line ~ /dport=4500 /)
    if (!is500 && !is4500) continue
    if (is500) ike[i]=1
    if (is4500) natt[i]=1
    if (is4500 && line ~ /\[ASSURED\]/) assured[i]=1
    epdg[i]=dst
    count=0; rest=line
    while (match(rest,/packets=[0-9]+/)) {
      val=substr(rest,RSTART+8,RLENGTH-8)+0; count++
      if (count==1) sent[i]=val; else if(count==2) reply[i]=val
      rest=substr(rest,RSTART+RLENGTH)
    }
  }
  next
}
END {
  print "{\"generated_at\":" now ",\"disclaimer\":\"Encrypted IPsec evidence only; calls and SMS cannot be distinguished.\",\"devices\":["
  for(i=1;i<=n;i++) {
    wfc=(assured[i]?"registered":natt[i]||ike[i]?"connecting":"not_detected")
    legacy=(assured[i] && sent[i]+reply[i]>=100?"active_traffic":assured[i]?"likely_registered":natt[i]?"nat_t_seen":ike[i]?"negotiating":"no_session")
    ds=(sent[i]>=old_sent[i]?sent[i]-old_sent[i]:sent[i])
    dr=(reply[i]>=old_reply[i]?reply[i]-old_reply[i]:reply[i])
    activity=(ds+dr>0?"encrypted_ims_traffic":"none")
    last=(ds+dr>0?now:old_last[i])
    if (ds+dr>0) {
      streak=(old_streak[i]+1)
      traffic_since=(old_streak[i]==0 ? now : old_traffic_since[i])
    } else {
      streak=0; traffic_since=0
    }
    acc_sent=old_acc_sent[i]+ds; acc_reply=old_acc_reply[i]+dr
    handshake_success=(old_wfc[i]!="registered" && wfc=="registered")
    handshake_failed=(wfc=="not_detected" && (old_wfc[i]=="registered" || old_wfc[i]=="connecting"))
    sustained=(!handshake_success && wfc=="registered" && streak>=1 && traffic_since>0 && now-traffic_since>=3 && now-old_event[i]>=event_interval)
    printf "%s{", (i>1?",":"")
    printf "\"label\":%s,\"ip\":%s,\"node\":%s,\"state\":%s,\"wificalling\":%s,", q(label[i]),q(ip[i]),q(node[i]),q(legacy),q(wfc)
    printf "\"epdg_ip\":%s,\"ike_seen\":%s,\"nat_t_seen\":%s,\"assured\":%s,", q(epdg[i]),(ike[i]?"true":"false"),(natt[i]?"true":"false"),(assured[i]?"true":"false")
    printf "\"sent_packets\":%d,\"reply_packets\":%d,\"delta_sent\":%d,\"delta_reply\":%d,\"last_activity\":%d,\"activity_evidence\":%s}", sent[i]+0,reply[i]+0,ds,dr,last,q(activity)
    if (log_enabled) {
      if (handshake_success) {
        print now "|" label[i] "|" ip[i] "|handshake_success|" ds "|" dr "|call_or_sms_unknown|" wfc > event_out
        old_event[i]=now; acc_sent=0; acc_reply=0
      } else if (handshake_failed) {
        print now "|" label[i] "|" ip[i] "|handshake_failed|" ds "|" dr "|call_or_sms_unknown|" wfc > event_out
        old_event[i]=now; acc_sent=0; acc_reply=0
      } else if (sustained) {
        print now "|" label[i] "|" ip[i] "|sustained_traffic|" acc_sent "|" acc_reply "|call_or_sms_unknown|" wfc > event_out
        old_event[i]=now; acc_sent=0; acc_reply=0
      }
    }
    print label[i] "|" ip[i] "|" wfc "|" sent[i]+0 "|" reply[i]+0 "|" last "|" old_event[i]+0 "|" streak "|" acc_sent "|" acc_reply "|" traffic_since+0 > state_out
  }
  print "]}"
}
' "$clients" "$state" "$conntrack" > "$tmp"

cat "$event_tmp" >> "$events"
awk -F '|' -v limit="$max_events" '
FNR==NR { count[$2 FS $3]++; next }
{ key=$2 FS $3; seen[key]++; if (seen[key] > count[key]-limit) print }
' "$events" "$events" > "$trim_tmp"
mv "$trim_tmp" "$events"
chmod 644 "$tmp" "$events"
chmod 600 "$state_tmp"
mv "$state_tmp" "$state"
mv "$tmp" "$output"
trap - EXIT HUP INT TERM
