# The background job: returns at once, one at a time, secrets, abort.
rm -f "$TR/tmp/vcstub.state"
r=$(rpc abort)
expect_error "abort without a running job refused" "$r" "No operation is running"

s=$(date +%s)
r=$(VCSTUB_DELAY=30 rpc mount '{"volume":"/mnt/usb/b.hc","mountpoint":"/mnt/J","password":"Hidden pw 2"}')
e=$(date +%s)
expect "mount started" "$(field "$r" '@.started')" true
[ $((e - s)) -lt 5 ] && ok "mount returns while the job runs" || nok "mount returns while the job runs" "took $((e - s))s"
sleep 1
r=$(rpc job)
expect "job is running" "$(field "$r" '@.running')" true
expect "running job has no rc" "$(field "$r" '@.rc')" ""
[ "$(field "$r" '@.elapsed')" -ge 0 ] 2>/dev/null && ok "running job reports elapsed time" || nok "running job reports elapsed time" "$r"
expect "status shows the running job" "$(field "$(rpc status)" '@.job.running')" true

leak=
for p in /proc/[0-9]*; do
	[ "$(readlink "$p/root" 2>/dev/null)" = "$TR" ] || continue
	tr '\0' ' ' < "$p/cmdline" 2>/dev/null | grep -q "Hidden pw" && leak="$leak cmdline:$p"
	tr '\0' '\n' < "$p/environ" 2>/dev/null | grep -v ^VCSTUB_ | grep -q "Hidden pw" && leak="$leak environ:$p"
done
expect "password in no argv or environment while the job runs" "$leak" ""
expect "veracrypt does not inherit the lock" "$(cat "$TR/tmp/vcstub.fd" 2>/dev/null)" ""

r=$(rpc mount '{"volume":"/mnt/usb/a.hc","mountpoint":"/mnt/K","password":"x"}')
expect_error "second job refused while one runs" "$r" "still running"
[ -e "$TR/mnt/K" ] && nok "refused job creates no mount directory" || ok "refused job creates no mount directory"
r=$(rpc create '{"volume":"/mnt/usb/n.hc","size":"1M","password":"x"}')
expect_error "create refused while a job runs" "$r" "still running"
[ -e "$TR/mnt/usb/n.hc" ] && nok "refused create writes nothing" || ok "refused create writes nothing"
expect "first job still described" "$(field "$(rpc job)" '@.op')" "mount /mnt/usb/b.hc"

vp=$(cat "$TR/tmp/vcstub.pid")
jp=$(cat "$TR/var/run/luci-veracrypt-lite/pid")
r=$(rpc abort)
expect "abort reports ok" "$(field "$r" '@.ok')" true
sleep 1
[ -d "/proc/$vp" ] && nok "abort stops veracrypt" "pid $vp alive" || ok "abort stops veracrypt"
[ -d "/proc/$jp" ] && nok "abort stops the job shell" "pid $jp alive" || ok "abort stops the job shell"
[ -e "$TR/mnt/J" ] && nok "abort removes the mount directory the job made" || ok "abort removes the mount directory the job made"
r=$(rpc job)
expect "aborted job is not running" "$(field "$r" '@.running')" false
expect "aborted job has no rc" "$(field "$r" '@.rc')" ""
r=$(rpc mount '{"volume":"/mnt/usb/a.hc","mountpoint":"/mnt/K","password":"x"}')
expect "a new job starts after abort" "$(field "$r" '@.started')" true
r=$(wait_job)
expect "new job finished" "$(field "$r" '@.rc')" 0
r=$(rpc abort)
expect_error "abort of a finished job refused" "$r" "No operation is running"

# Abort never signals a pid that is no longer the job's.
sleep 60 & sp=$!
echo "$sp" > "$TR/var/run/luci-veracrypt-lite/pid"
rpc abort > /dev/null
[ -d "/proc/$sp" ] && ok "abort of a finished job leaves other processes alone" || nok "abort of a finished job leaves other processes alone"
# ... nor one that reuses the pid of a job that died without writing rc.
rm -f "$TR/var/run/luci-veracrypt-lite/rc"
echo "$sp" > "$TR/var/run/luci-veracrypt-lite/pid"
r=$(rpc abort)
expect_error "abort of a job that died refused" "$r" "No operation is running"
[ -d "/proc/$sp" ] && ok "abort leaves a process with the job's old pid alone" || nok "abort leaves a process with the job's old pid alone"
expect "a job that died is not running" "$(field "$(rpc job)" '@.running')" false
kill "$sp"; wait "$sp" 2>/dev/null

# The log is the last 8 KiB of the output.
r=$(rpc create_keyfile '{"path":"/mnt/usb/k1"}')
yes 0123456789abcdef | head -c 20000 > "$TR/var/run/luci-veracrypt-lite/log"
echo END >> "$TR/var/run/luci-veracrypt-lite/log"
r=$(rpc job)
l=$(field "$r" '@.log')
expect "log is cut to 8 KiB" "${#l}" 8191
case $l in *END) ok "log keeps the end" ;; *) nok "log keeps the end" ;; esac

# The helper refuses incomplete input.
r=$(printf 'op\n' | /usr/sbin/chroot "$TR" /usr/libexec/luci-veracrypt-lite-job; echo $?)
expect "helper without password and arguments exits 2" "$r" 2
