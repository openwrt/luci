# Paths in shares changed while root works on them, keyfile list parsing,
# names, abort of finished jobs.
inroot 'rm -f /tmp/vcstub.state'

# Mountpoints must be directly under /mnt.
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/usb/inside","password":"x"}')
expect "mountpoint inside a share refused" "$(field "$r" '@.error')" "mountpoint must be a directory directly under /mnt (e.g. /mnt/<name>)"

# Keyfile lists: no "..", no ",,," (split differently by veracrypt).
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x","keyfiles":"/mnt/usb/nodir/../../../etc/shadow"}')
expect "keyfile with .. refused" "$(field "$r" '@.ok')" false
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A","password":"x","keyfiles":"/mnt/usb/a,,,/etc/shadow"}')
expect "keyfile list with ,,, refused" "$(field "$r" '@.ok')" false

# A favorite name with a line break is invalid (it would reach uci get).
printf '%s' '{"action":"mount","name":"abc\n;x","password":"x"}' > "$TR/tmp/req.json"
r=$(inroot '/usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
expect "favorite name with a line break refused" "$(field "$r" '@.error')" "invalid volume name"

# create writes the container from a private directory, then renames it.
rm -f "$TR/mnt/usb/pinned.hc"
r=$(rpc run '{"action":"create","volume":"/mnt/usb/pinned.hc","size":"1M","password":"x","filesystem":"none"}')
r=$(wait_job "$(field "$r" '@.job')")
[ -f "$TR/mnt/usb/pinned.hc" ] && [ ! -L "$TR/mnt/usb/pinned.hc" ] && ok "container created at its name" || nok "container created at its name"
expect "no private create directory left behind" "$(ls -a "$TR/mnt/usb" | grep -c '^\.vc-new\.')" 0
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/pinned.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
r=$(rpc run '{"action":"create","volume":"/mnt/usb/pinned.hc","size":"1M","password":"x","filesystem":"none"}')
expect "create over an existing file refused" "$(field "$r" '@.error')" "/mnt/usb/pinned.hc already exists; choose a new file name (or use force to overwrite)"
rm -f "$TR/mnt/usb/pinned.hc"

# create-keyfile writes privately and places the file; a symlink at the
# name that leads outside /mnt is refused and its target kept.
rm -f "$TR/mnt/usb/new2.key"
r=$(rpc run '{"action":"create-keyfile","volume":"/mnt/usb/new2.key"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "keyfile created" "$(field "$r" '@.ok')" true
[ -s "$TR/mnt/usb/new2.key" ] && [ ! -L "$TR/mnt/usb/new2.key" ] && ok "keyfile is a regular file at its name" || nok "keyfile is a regular file at its name"
printf 'outside' > "$TR/tmp/kf-victim"
ln -sf /tmp/kf-victim "$TR/mnt/usb/swap.key"
r=$(rpc run '{"action":"create-keyfile","volume":"/mnt/usb/swap.key"}')
[ "$(field "$r" '@.ok')" = true ] && r=$(wait_job "$(field "$r" '@.job')")
expect "keyfile onto a symlink leading outside /mnt fails" "$(field "$r" '@.ok')" false
expect "symlink target of the keyfile untouched" "$(cat "$TR/tmp/kf-victim")" outside
rm -f "$TR/mnt/usb/new2.key" "$TR/mnt/usb/swap.key" "$TR/tmp/kf-victim"

# mkdir never follows a symlinked directory.
r=$(rpc mkdir '{"path":"/mnt/usb/newdir/sub"}'); expect "mkdir of nested new directories" "$(field "$r" '@.ok')" true
[ -d "$TR/mnt/usb/newdir/sub" ] && ok "nested directories created" || nok "nested directories created"
r=$(rpc mkdir '{"path":"/mnt/usb/etclink/evil"}'); expect "mkdir through a symlink to /etc refused" "$(field "$r" '@.ok')" false
[ -e "$TR/etc/evil" ] && nok "nothing created in /etc" || ok "nothing created in /etc"
rmdir "$TR/mnt/usb/newdir/sub" "$TR/mnt/usb/newdir"

# Abort of a finished job does nothing.
r=$(rpc run '{"action":"test"}'); j=$(field "$r" '@.job'); wait_job "$j" >/dev/null
r=$(rpc job_abort "{\"id\":\"$j\"}")
expect "abort of a finished job" "$(field "$r" '@.output')" "job already finished"

# A hidden volume goes into the existing outer container: it is opened in
# place (no "already exists"), kept, and nothing is left behind.
printf 'outer\n' > "$TR/mnt/usb/outer.hc"
r=$(rpc run '{"action":"create","volume":"/mnt/usb/outer.hc","volume_type":"hidden","size":"1M","password":"x","filesystem":"none"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "hidden volume created in an existing container" "$(field "$r" '@.ok')" true
expect "outer container kept and written in place" "$(cat "$TR/mnt/usb/outer.hc")" "outer
hidden"
expect "no private create directory left after hidden create" "$(ls -a "$TR/mnt/usb" | grep -c '^\.vc-new\.')" 0
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/outer.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
r=$(rpc run '{"action":"create","volume":"/mnt/usb/nosuch.hc","volume_type":"hidden","size":"1M","password":"x","filesystem":"none"}')
expect "hidden volume needs an existing outer container" "$(field "$r" '@.error')" "a hidden volume is created inside an existing outer container; /mnt/usb/nosuch.hc is not a regular file"
printf 'outside' > "$TR/tmp/hv-victim"
ln -sf /tmp/hv-victim "$TR/mnt/usb/hlink.hc"
r=$(rpc run '{"action":"create","volume":"/mnt/usb/hlink.hc","volume_type":"hidden","size":"1M","password":"x","filesystem":"none"}')
expect "hidden volume into a symlink refused" "$(field "$r" '@.ok')" false
expect "symlink target of the hidden volume untouched" "$(cat "$TR/tmp/hv-victim")" outside
ln "$TR/mnt/usb/outer.hc" "$TR/mnt/usb/outer2.hc"
r=$(rpc run '{"action":"create","volume":"/mnt/usb/outer.hc","volume_type":"hidden","size":"1M","password":"x","filesystem":"none"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "hidden volume into a hard-linked container fails" "$(field "$r" '@.ok')" false
[ -f "$TR/mnt/usb/outer.hc" ] && ok "hard-linked container put back" || nok "hard-linked container put back"
expect "no private create directory left after refusal" "$(ls -a "$TR/mnt/usb" | grep -c '^\.vc-new\.')" 0
rm -f "$TR/mnt/usb/outer.hc" "$TR/mnt/usb/outer2.hc" "$TR/mnt/usb/hlink.hc" "$TR/tmp/hv-victim"
