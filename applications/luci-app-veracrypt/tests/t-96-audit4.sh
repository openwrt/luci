# Regressions from the fourth review: header restore and aborts with pinned
# paths, unmount of volumes mounted under other path rules, prompts.
inroot 'rm -f /tmp/vcstub.state /tmp/vcstub.fail.create'
nopin() { ls -a "$TR/mnt/usb" | grep -c '^\.vc-new\.'; }

# Header restore into a container file writes the file in place.
printf 'vol\n' > "$TR/mnt/usb/r.hc"
printf 'HEADERS' > "$TR/mnt/usb/r.hdr"
r=$(rpc run '{"action":"restore-headers","volume":"/mnt/usb/r.hc","backup_file":"/mnt/usb/r.hdr","password":"x"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "header restore into a container file" "$(field "$r" '@.ok')" true
expect "restored in place" "$(cat "$TR/mnt/usb/r.hc")" "vol
restored"
expect "no private directory left after restore" "$(nopin)" 0

# The name swapped for a symlink while the backup header is decrypted: the
# symlink target is never written.
printf 'outside' > "$TR/tmp/rs-victim"
printf '%s' '{"action":"restore-headers","volume":"/mnt/usb/r.hc","backup_file":"/mnt/usb/r.hdr","password":"x"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_RDELAY=4 /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
j=$(field "$r" '@.job')
sleep 2
rm -f "$TR/mnt/usb/r.hc"
ln -s /tmp/rs-victim "$TR/mnt/usb/r.hc"
r=$(wait_job "$j")
expect "restore onto a swapped name fails" "$(field "$r" '@.ok')" false
expect "symlink target of the restore untouched" "$(cat "$TR/tmp/rs-victim")" outside
expect "container kept in the private directory" "$(cat "$TR"/mnt/usb/.vc-new.*/r.hc 2>/dev/null | grep -c restored)" 2
rm -f "$TR/mnt/usb/r.hc" "$TR/tmp/rs-victim"
rm -rf "$TR"/mnt/usb/.vc-new.*

# The name only removed meanwhile: the container is linked back.
printf 'vol\n' > "$TR/mnt/usb/r.hc"
printf '%s' '{"action":"restore-headers","volume":"/mnt/usb/r.hc","backup_file":"/mnt/usb/r.hdr","password":"x"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_RDELAY=4 /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
j=$(field "$r" '@.job')
sleep 2
rm -f "$TR/mnt/usb/r.hc"
r=$(wait_job "$j")
expect "restore reports the removed name" "$(field "$r" '@.ok')" false
expect "container linked back at its name" "$(cat "$TR/mnt/usb/r.hc" 2>/dev/null)" "vol
restored"
expect "no private directory left after relink" "$(nopin)" 0
rm -f "$TR/mnt/usb/r.hc" "$TR/mnt/usb/r.hdr"

# Abort during a hidden create puts the outer container back.
printf 'outer\n' > "$TR/mnt/usb/ab.hc"
printf '%s' '{"action":"create","volume":"/mnt/usb/ab.hc","volume_type":"hidden","size":"1M","password":"x","filesystem":"none"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_DELAY=20 /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
j=$(field "$r" '@.job')
sleep 2
r=$(rpc job_abort "{\"id\":\"$j\"}")
expect "abort of a hidden create" "$(field "$r" '@.ok')" true
expect "outer container back at its name" "$(cat "$TR/mnt/usb/ab.hc" 2>/dev/null)" outer
expect "no private directory left after abort" "$(nopin)" 0
rm -f "$TR/mnt/usb/ab.hc"

# Abort during a normal create leaves no partial file.
printf '%s' '{"action":"create","volume":"/mnt/usb/ab2.hc","size":"1M","password":"x","filesystem":"none"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_DELAY=20 /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
j=$(field "$r" '@.job')
sleep 2
rpc job_abort "{\"id\":\"$j\"}" >/dev/null
[ -e "$TR/mnt/usb/ab2.hc" ] && nok "no partial container after abort" || ok "no partial container after abort"
expect "no private directory left after aborted create" "$(nopin)" 0

# A failed create never replaces the existing file (force).
printf 'keep\n' > "$TR/mnt/usb/keep.hc"
inroot 'touch /tmp/vcstub.fail.create'
r=$(rpc run '{"action":"create","volume":"/mnt/usb/keep.hc","size":"1M","password":"x","filesystem":"none","force":"1"}')
r=$(wait_job "$(field "$r" '@.job')")
inroot 'rm -f /tmp/vcstub.fail.create'
expect "failed create reported" "$(field "$r" '@.ok')" false
expect "existing file kept after a failed create" "$(cat "$TR/mnt/usb/keep.hc")" keep
expect "no private directory left after failed create" "$(nopin)" 0
rm -f "$TR/mnt/usb/keep.hc"

# create never writes over a mounted container.
printf '3\t/mnt/usb/a.hc\t/dev/loop3\t/mnt/A3\n' > "$TR/tmp/vcstub.state"
r=$(rpc run '{"action":"create","volume":"/mnt/usb/a.hc","size":"1M","password":"x","filesystem":"none","force":"1"}')
expect "create over a mounted container refused" "$(field "$r" '@.error')" "/mnt/usb/a.hc is mounted; unmount it first"

# Unmount works for volumes mounted under older path rules.
printf '5\t/mnt/usb/old.hc\t/dev/loop5\t/mnt/usb/oldmp\n6\t/root/x.hc\t/dev/loop6\t/media/x\n' > "$TR/tmp/vcstub.state"
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/old.hc","mountpoint":"/mnt/usb/oldmp","slot":"5"}')
expect "unmount of a nested mountpoint accepted" "$(field "$r" '@.ok')" true
wait_job "$(field "$r" '@.job')" >/dev/null
r=$(rpc run '{"action":"unmount","volume":"/root/x.hc"}')
expect "unmount of a volume outside /mnt accepted" "$(field "$r" '@.ok')" true
wait_job "$(field "$r" '@.job')" >/dev/null
expect "both unmounted" "$(cat "$TR/tmp/vcstub.state")" ""
r=$(rpc run '{"action":"unmount","volume":"/root/other.hc"}')
expect "unmount of an unlisted path outside /mnt still refused" "$(field "$r" '@.ok')" false

# Quick format through the prompt dialog (token PIN set).
rm -f "$TR/mnt/usb/q.hc"
r=$(rpc run '{"action":"create","volume":"/mnt/usb/q.hc","size":"1M","password":"x","filesystem":"none","quick":"1","token_pin":"1234"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "quick format answered in the dialog" "$(field "$r" '@.ok')" true
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/q.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
rm -f "$TR/mnt/usb/q.hc"
inroot 'rm -f /tmp/vcstub.state'

# Keyfile-only volumes can be backed up.
: > "$TR/mnt/usb/k.key"
r=$(rpc run '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/mnt/usb/k.hdr","keyfiles":"/mnt/usb/k.key"}')
expect "header backup with keyfiles only accepted" "$(field "$r" '@.error')" ""
wait_job "$(field "$r" '@.job')" >/dev/null
rm -f "$TR/mnt/usb/k.key" "$TR/mnt/usb/k.hdr"

# Directories made from the UI are usable by share users.
r=$(rpc mkdir '{"path":"/mnt/usb/shared"}')
expect "new directory is mode 755" "$(stat -c %a "$TR/mnt/usb/shared")" 755
rmdir "$TR/mnt/usb/shared"

# Abort without a job id.
r=$(rpc job_abort '{"id":""}')
expect "abort without a job id" "$(field "$r" '@.error')" "no job"

# mount with filesystem "none" only maps the volume; other values are ignored.
inroot 'rm -f /tmp/vcstub.state'
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/Map","password":"x","filesystem":"none"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "mount with filesystem none" "$(field "$r" '@.ok')" true
expect "volume mapped without a mounted filesystem" "$(cut -f4 "$TR/tmp/vcstub.state")" "-"
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/a.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/Map","password":"x","filesystem":"ext4"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "other filesystem values leave detection to veracrypt" "$(cut -f4 "$TR/tmp/vcstub.state")" /mnt/Map
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/a.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
