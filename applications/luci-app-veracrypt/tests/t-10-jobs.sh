# Jobs are isolated: two concurrent jobs, aborting one leaves the other alone.
inroot 'rm -f /tmp/vcstub.state'

ra=$(inroot 'printf %s "{\"action\":\"test\"}" | VCSTUB_DELAY=3 /usr/libexec/rpcd/luci.veracrypt call run')
rb=$(inroot 'printf %s "{\"action\":\"test\"}" | VCSTUB_DELAY=3 /usr/libexec/rpcd/luci.veracrypt call run')
ja=$(field "$ra" '@.job')
jb=$(field "$rb" '@.job')
expect "job id is 16 hex digits" "$(printf '%s' "$ja" | grep -c '^[0-9a-f]\{16\}$')" 1
[ -n "$ja" ] && [ "$ja" != "$jb" ] && ok "concurrent jobs get distinct ids" || nok "concurrent jobs get distinct ids" "$ja / $jb"

r=$(rpc job_abort "{\"id\":\"$jb\"}")
expect "abort job B" "$(field "$r" '@.ok')" true
r=$(wait_job "$ja")
expect "job A still finishes ok after B was aborted" "$(field "$r" '@.ok')" true
r=$(rpc job "{\"id\":\"$jb\"}")
expect "job B reports aborted" "$(field "$r" '@.ok')" false

r=$(rpc job '{"id":"0123456789abcdef"}')
expect "unknown job id is rejected" "$(field "$r" '@.error')" "no job"
r=$(rpc job '{"id":"../../etc"}')
expect "malformed job id is rejected" "$(field "$r" '@.error')" "no job"
r=$(rpc job '{}')
expect "missing job id is rejected" "$(field "$r" '@.error')" "no job"
