# Prompt text in paths, private header backups, mounting over mounts, the
# job limit, no recursive delete, no secrets on jshn's command line.
inroot 'rm -f /tmp/vcstub.state /tmp/vcstub.hiddenpw /tmp/vcstub.kf /tmp/vcstub.hkf'

# A file name that contains prompt text does not decide which secret is sent.
: > "$TR/mnt/usb/x password for hidden volume"
printf '%s' '{"action":"mount","volume":"/mnt/usb/x password for hidden volume","mountpoint":"/mnt/X","password":"Outer1","protect_hidden":"yes","protection_password":"Hidden2"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_PW=Outer1 VCSTUB_HPW=Hidden2 /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
r=$(wait_job "$(field "$r" '@.job')")
expect "prompt text in a file name: mount still succeeds" "$(field "$r" '@.ok')" true
expect "prompt text in a file name: hidden password went to the hidden prompt" "$(cat "$TR/tmp/vcstub.hiddenpw" 2>/dev/null)" Hidden2
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/x password for hidden volume"}'); wait_job "$(field "$r" '@.job')" >/dev/null

: > "$TR/mnt/usb/Re-enter password"
printf '%s' '{"action":"mount","volume":"/mnt/usb/Re-enter password","mountpoint":"/mnt/Y","password":"x","protect_hidden":"yes","protection_password":"h"}' > "$TR/tmp/req.json"
s=$(date +%s)
r=$(inroot '/usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
r=$(wait_job "$(field "$r" '@.job')")
e=$(date +%s)
expect "prompt text in a file name: no answer loop" "$(field "$r" '@.ok')" true
[ $((e - s)) -lt 25 ] && ok "prompt text in a file name: finishes quickly" || nok "prompt text in a file name: finishes quickly" "$((e - s))s"
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/Re-enter password"}'); wait_job "$(field "$r" '@.job')" >/dev/null

# The header backup is written privately, then placed by name.
rm -f "$TR/mnt/usb/hdr3.bak"
r=$(rpc run '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/mnt/usb/hdr3.bak","password":"x"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "header backup succeeds" "$(field "$r" '@.ok')" true
expect "header backup content placed" "$(cat "$TR/mnt/usb/hdr3.bak" 2>/dev/null)" HEADERS
expect "no private copy left behind" "$(ls "$TR"/tmp/run/luci-veracrypt/*/job.hdr 2>/dev/null)" ""

# Mounting over another mount is refused.
mkdir -p "$TR/mnt/Disk2"
printf '%s' '{"action":"mount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/Disk2","password":"x"}' > "$TR/tmp/req.json"
r=$(inroot 'mount -t tmpfs t /mnt/Disk2 && /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
expect "mount over an existing mount refused" "$(field "$r" '@.error')" "/mnt/Disk2 is already a mount point; choose an empty directory"

# Delete is not recursive.
mkdir -p "$TR/mnt/usb/full/sub"; : > "$TR/mnt/usb/full/sub/f"
r=$(rpc rm '{"path":"/mnt/usb/full"}')
expect "non-empty directory is not deleted" "$(field "$r" '@.ok')" false
[ -e "$TR/mnt/usb/full/sub/f" ] && ok "its contents are kept" || nok "its contents are kept"
r=$(rpc rm '{"path":"/mnt/usb/full/sub/f"}'); expect "a file is deleted" "$(field "$r" '@.ok')" true
r=$(rpc rm '{"path":"/mnt/usb/full/sub"}'); expect "an empty directory is deleted" "$(field "$r" '@.ok')" true

# At most four jobs run at the same time.
ids=
for i in 1 2 3 4; do
	r=$(inroot 'printf %s "{\"action\":\"test\"}" | VCSTUB_DELAY=15 /usr/libexec/rpcd/luci.veracrypt call run')
	ids="$ids $(field "$r" '@.job')"
done
r=$(rpc run '{"action":"test"}')
expect "fifth concurrent job refused" "$(field "$r" '@.error')" "too many VeraCrypt jobs are running; wait for one to finish"
for j in $ids; do rpc job_abort "{\"id\":\"$j\"}" >/dev/null; done

# The request (with its passwords) never appears on jshn's command line.
mv "$TR/usr/bin/jshn" "$TR/usr/bin/jshn.real"
printf '#!/bin/sh\nprintf "%%s\\n" "$*" >> /tmp/jshn.argv\nexec /usr/bin/jshn.real "$@"\n' > "$TR/usr/bin/jshn"
chmod 755 "$TR/usr/bin/jshn"; rm -f "$TR/tmp/jshn.argv"
printf '%s' '{"action":"mount","volume":"/mnt/usb/b.hc","mountpoint":"/mnt/B2","password":"ArgvSecret77"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_PW=ArgvSecret77 /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
need_job "$r" "mount with a secret password"
r=$(wait_job "$J")
expect "mount with a secret password succeeds" "$(field "$r" '@.ok')" true
if [ -s "$TR/tmp/jshn.argv" ] && ! grep -q ArgvSecret77 "$TR/tmp/jshn.argv"; then
	ok "password not on jshn's command line"
else
	nok "password not on jshn's command line" "jshn not run, or the password was on its command line"
fi
mv "$TR/usr/bin/jshn.real" "$TR/usr/bin/jshn"
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/b.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null

# The header backup is placed by rename, never written through a name: an
# existing name (here a symlink) is kept unless forced; forced, the symlink
# itself is replaced and its target is untouched.
printf 'HEADERS' > "$TR/tmp/hdr.src"
printf 'keep' > "$TR/mnt/usb/other.file"
ln -sf /mnt/usb/other.file "$TR/mnt/usb/swapped.bak"
r=$(inroot '. /usr/libexec/rpcd/luci.veracrypt; on_storage() { return 0; }; place_file /tmp/hdr.src /mnt/usb/swapped.bak && echo placed || echo refused')
expect "existing name kept without force" "$r" refused
[ -L "$TR/mnt/usb/swapped.bak" ] && ok "the symlink is kept" || nok "the symlink is kept"
r=$(inroot '. /usr/libexec/rpcd/luci.veracrypt; on_storage() { return 0; }; place_file /tmp/hdr.src /mnt/usb/swapped.bak force && echo placed')
expect "header placed over a symlink when forced" "$r" placed
expect "the symlink's target is untouched" "$(cat "$TR/mnt/usb/other.file")" keep
if [ -L "$TR/mnt/usb/swapped.bak" ]; then nok "the symlink is replaced by the backup"; else ok "the symlink is replaced by the backup"; fi
expect "the backup has the header" "$(cat "$TR/mnt/usb/swapped.bak")" HEADERS

printf 'outside' > "$TR/tmp/pf-victim"
ln -sf /tmp/pf-victim "$TR/mnt/usb/out.bak"
r=$(inroot '. /usr/libexec/rpcd/luci.veracrypt; on_storage() { return 0; }; place_file /tmp/hdr.src /mnt/usb/out.bak && echo placed || echo refused')
expect "symlink leading outside /mnt refused" "$r" refused
expect "file outside /mnt untouched" "$(cat "$TR/tmp/pf-victim")" outside

mkdir -p "$TR/mnt/usb/realdir"; ln -sfn realdir "$TR/mnt/usb/dirswap.bak"
r=$(inroot '. /usr/libexec/rpcd/luci.veracrypt; on_storage() { return 0; }; place_file /tmp/hdr.src /mnt/usb/dirswap.bak 2>/dev/null && echo placed || echo refused')
expect "directory symlink as backup name refused" "$r" refused
expect "nothing written into the directory" "$(ls "$TR/mnt/usb/realdir" | wc -l)" 0
expect "no temporary file left behind" "$(ls -a "$TR/mnt/usb" | grep -c vc-tmp)" 0
rm -f "$TR/mnt/usb/swapped.bak" "$TR/mnt/usb/out.bak" "$TR/mnt/usb/dirswap.bak" "$TR/mnt/usb/other.file" "$TR/tmp/pf-victim"
