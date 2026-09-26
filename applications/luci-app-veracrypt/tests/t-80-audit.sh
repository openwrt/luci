# Regressions: line breaks in answers, abort, hidden-volume prompts, derived
# mountpoints, secrets in the environment, job root, symlinked paths.
inroot 'rm -f /tmp/vcstub.*'
alive() { # alive <pid>: running (not a zombie)
	[ -d "/proc/$1" ] && [ "$(awk '/^State:/ { print $2 }' "/proc/$1/status" 2>/dev/null)" != Z ]
}
logof() { field "$(rpc job_log "{\"id\":\"$1\"}")" '@.output'; }

# A line break in a password must not answer the following prompts.
r=$(rpc run '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/mnt/usb/legit.bak","password":"x\n\n\nn\ny\n/etc/victim"}')
expect "password with line breaks refused" "$(field "$r" '@.error')" "password must not contain line breaks"
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x","protect_hidden":"yes","protection_password":"h\r/etc/x"}')
expect "carriage return in hidden password refused" "$(field "$r" '@.ok')" false
r=$(rpc run '{"action":"change","volume":"/mnt/usb/a.hc","password":"x","new_password":"a\nb"}')
expect "line break in new password refused" "$(field "$r" '@.ok')" false

# The call returns while the job runs (background jobs do not hold rpcd's stdout).
s=$(date +%s)
r=$(inroot 'printf %s "{\"action\":\"test\"}" | VCSTUB_DELAY=20 /usr/libexec/rpcd/luci.veracrypt call run')
e=$(date +%s)
j=$(field "$r" '@.job')
[ $((e - s)) -lt 5 ] && ok "run returns before the job ends" || nok "run returns before the job ends" "took $((e - s))s"
sleep 1
vp=$(tail -n 1 "$TR/tmp/vcstub.pids")
jp=$(cat "$TR/tmp/run/luci-veracrypt/$j/job.pid")
alive "$vp" && ok "veracrypt of the job is running" || nok "veracrypt of the job is running"
r=$(rpc job_abort "{\"id\":\"$j\"}")
expect "abort reports ok" "$(field "$r" '@.ok')" true
sleep 1
alive "$vp" && nok "abort stops veracrypt" "pid $vp alive" || ok "abort stops veracrypt"
alive "$jp" && nok "abort stops the job shell" "pid $jp alive" || ok "abort stops the job shell"

# Abort of a finished job never signals its (possibly reused) pid.
r=$(rpc run '{"action":"test"}'); j=$(field "$r" '@.job'); wait_job "$j" >/dev/null
sleep 60 & sp=$!
echo "$sp" > "$TR/tmp/run/luci-veracrypt/$j/job.pid"
rpc job_abort "{\"id\":\"$j\"}" >/dev/null
alive "$sp" && ok "abort of a finished job leaves other processes alone" || nok "abort of a finished job leaves other processes alone"
kill "$sp" 2>/dev/null; wait "$sp" 2>/dev/null

# Mount with hidden-volume protection answers the prompts, never argv/stdin blind.
inroot 'rm -f /tmp/vcstub.state /tmp/vcstub.hiddenpw /tmp/vcstub.hkf /tmp/vcstub.kf'
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x","protect_hidden":"yes","protection_password":"HidPw1"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "mount with hidden protection succeeds" "$(field "$r" '@.ok')" true
expect "hidden password answered at the hidden prompt" "$(cat "$TR/tmp/vcstub.hiddenpw" 2>/dev/null)" HidPw1
expect "no hidden keyfile was invented" "$(cat "$TR/tmp/vcstub.hkf" 2>/dev/null)" ""
expect "no outer keyfile was invented" "$(cat "$TR/tmp/vcstub.kf" 2>/dev/null)" ""
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/a.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x","protect_hidden":"yes"}')
expect "hidden protection without its password refused" "$(field "$r" '@.ok')" false

# A wrong hidden-volume password ends the job instead of looping.
printf '%s' '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x","protect_hidden":"yes","protection_password":"wrong"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_HPW=right /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
j=$(field "$r" '@.job'); r=$(wait_job "$j")
expect "wrong hidden password on mount fails" "$(field "$r" '@.ok')" false
case $(logof "$j") in *"wrong hidden volume password"*) ok "wrong hidden password is reported" ;; *) nok "wrong hidden password is reported" "$(logof "$j")" ;; esac
printf '%s' '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/mnt/usb/h.bak","password":"x","protection_password":"wrong"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_HPW=right /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
r=$(wait_job "$(field "$r" '@.job')")
expect "wrong hidden password on header backup fails" "$(field "$r" '@.ok')" false

# The mountpoint derived from a container name stays a directory under /mnt.
inroot 'rm -f /tmp/vcstub.state'
r=$(rpc run '{"action":"create","volume":"/mnt/usb/..hc","size":"1M","password":"x"}')
case $(field "$r" '@.output') in *"/mnt/vc"[0-9]*) ok "create with ..hc mounts on /mnt/vcN" ;; *) nok "create with ..hc mounts on /mnt/vcN" "$(field "$r" '@.output')" ;; esac
wait_job "$(field "$r" '@.job')" >/dev/null
rm -f "$TR/mnt/usb/..hc"

# Secrets are not in the environment of veracrypt (or any other child).
inroot 'rm -f /tmp/vcstub.state /tmp/vcstub.env'
printf '%s' '{"action":"mount","volume":"/mnt/usb/b.hc","mountpoint":"/mnt/B","password":"EnvSecret1"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_ENV=1 VCSTUB_PW=EnvSecret1 /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
wait_job "$(field "$r" '@.job')" >/dev/null
# (VCSTUB_PW is the test's own variable for the fake veracrypt.)
[ -s "$TR/tmp/vcstub.env" ] && ! grep -v '^VCSTUB_' "$TR/tmp/vcstub.env" | grep -q EnvSecret1 && ok "password not in the child environment" \
	|| nok "password not in the child environment" "$(grep -v '^VCSTUB_' "$TR/tmp/vcstub.env" | grep EnvSecret1)"

# Paths through a symlink inside /mnt are resolved before use.
mkdir -p "$TR/mnt/usb/real"
ln -s "/mnt/usb/real" "$TR/mnt/usb/mlink"
ln -s /etc/hdr "$TR/mnt/usb/hdrlink"
inroot 'rm -f /tmp/vcstub.state'
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/usb/mlink/","password":"x"}')
expect "mountpoint inside a share (via symlink) refused" "$(field "$r" '@.error')" "mountpoint must be a directory directly under /mnt (e.g. /mnt/<name>)"
r=$(rpc run '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/mnt/usb/hdrlink","password":"x"}')
expect "header backup onto a symlink refused" "$(field "$r" '@.ok')" false

# unmount never lazily unmounts a mountpoint that is not a VeraCrypt volume.
mkdir -p "$TR/mnt/Disk"
printf '%s' '{"action":"unmount","mountpoint":"/mnt/Disk"}' > "$TR/tmp/req.json"
n=$(inroot 'mount -t tmpfs t /mnt/Disk && /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json >/dev/null && sleep 3 && grep -c " /mnt/Disk " /proc/mounts')
expect "unmount leaves a non-VeraCrypt mount alone" "$n" 1

# The job root is never a symlink planted in /tmp.
rm -rf "$TR/tmp/run/luci-veracrypt" "$TR/tmp/victim"
mkdir -m 755 "$TR/tmp/victim"
ln -s /tmp/victim "$TR/tmp/run/luci-veracrypt"
r=$(rpc run '{"action":"test"}')
expect "symlinked job root refused" "$(field "$r" '@.error')" "cannot create job"
expect "symlink target untouched" "$(stat -c %a "$TR/tmp/victim")" 755
rm -f "$TR/tmp/run/luci-veracrypt"
