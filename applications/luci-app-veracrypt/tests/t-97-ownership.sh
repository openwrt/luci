# Unmount and abort only touch what they own, mounted containers are not
# restored over or deleted, the job limit holds under concurrent calls,
# hidden creates keep the container at its name, stale private
# directories are recovered.
inroot 'rm -f /tmp/vcstub.state /tmp/vcstub.fail.create'

# A favorite's configured slot holds another volume: only the requested
# volume is unmounted.
printf '1\t/mnt/usb/a.hc\t/dev/loop1\t/mnt/A1\n3\t/mnt/usb/b.hc\t/dev/loop3\t/mnt/B3\n' > "$TR/tmp/vcstub.state"
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/a.hc","mountpoint":"/mnt/A1","slot":"3"}')
wait_job "$(field "$r" '@.job')" >/dev/null
expect "unmount leaves the volume in the configured slot alone" "$(cut -f2 "$TR/tmp/vcstub.state")" /mnt/usb/b.hc
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/none.hc","slot":"3"}')
expect "unmount of a volume that is not mounted refused" "$(field "$r" '@.error')" "/mnt/usb/none.hc is not mounted by VeraCrypt"
expect "nothing unmounted for it" "$(cut -f2 "$TR/tmp/vcstub.state")" /mnt/usb/b.hc

# Mounted containers are neither restored over nor deleted.
printf 'HEADERS' > "$TR/mnt/usb/b.hdr"
r=$(rpc run '{"action":"restore-headers","volume":"/mnt/usb/b.hc","backup_file":"/mnt/usb/b.hdr","password":"x"}')
expect "header restore into a mounted container refused" "$(field "$r" '@.error')" "/mnt/usb/b.hc is mounted; unmount it first"
r=$(rpc rm '{"path":"/mnt/usb/b.hc"}')
expect "deleting a mounted container refused" "$(field "$r" '@.error')" "/mnt/usb/b.hc is mounted; unmount it before deleting it"
[ -e "$TR/mnt/usb/b.hc" ] && ok "mounted container still there" || nok "mounted container still there"
rm -f "$TR/mnt/usb/b.hdr"
inroot 'rm -f /tmp/vcstub.state'

# The job limit (4) holds when calls arrive at the same time.
settle
for i in 1 2 3 4 5 6; do
	inroot 'printf %s "{\"action\":\"test\"}" | VCSTUB_DELAY=8 /usr/libexec/rpcd/luci.veracrypt call run' > "$TR/tmp/par.$i" &
done
wait
n=$(cat "$TR"/tmp/par.* | grep -c '"pending": true')
expect "at most 4 of 6 parallel jobs started" "$([ "$n" -le 4 ] && [ "$n" -ge 1 ] && echo yes)" yes
rm -f "$TR"/tmp/par.*
settle

# A hidden create keeps the container at its name the whole time (hard
# link in the private directory) and leaves a single link behind.
printf 'outer\n' > "$TR/mnt/usb/hl.hc"
printf '%s' '{"action":"create","volume":"/mnt/usb/hl.hc","volume_type":"hidden","size":"1M","password":"x","filesystem":"none"}' > "$TR/tmp/req.json"
r=$(inroot 'VCSTUB_DELAY=4 /usr/libexec/rpcd/luci.veracrypt call run < /tmp/req.json')
j=$(field "$r" '@.job')
sleep 2
[ -f "$TR/mnt/usb/hl.hc" ] && ok "container stays at its name during a hidden create" || nok "container stays at its name during a hidden create"
r=$(wait_job "$j")
expect "hidden create through a hard link" "$(field "$r" '@.ok')" true
expect "single link left" "$(ls -ln "$TR/mnt/usb/hl.hc" | awk '{ print $2 }')" 1
expect "hidden volume written into the container" "$(cat "$TR/mnt/usb/hl.hc")" "outer
hidden"
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/hl.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
rm -f "$TR/mnt/usb/hl.hc"

# A private directory left by an interrupted rename (e.g. a reboot) is
# recovered by the next create in that directory.
mkdir -m 700 "$TR/mnt/usb/.vc-new.00000000000000aa"
printf 'lost\n' > "$TR/mnt/usb/.vc-new.00000000000000aa/lost.hc"
printf 'lost.hc\nr\n' > "$TR/mnt/usb/.vc-new.00000000000000aa/.vc-pin"
r=$(rpc run '{"action":"create","volume":"/mnt/usb/fresh.hc","size":"1M","password":"x","filesystem":"none"}')
wait_job "$(field "$r" '@.job')" >/dev/null
expect "stranded container put back at its name" "$(cat "$TR/mnt/usb/lost.hc" 2>/dev/null)" lost
[ -d "$TR/mnt/usb/.vc-new.00000000000000aa" ] && nok "stale private directory removed" || ok "stale private directory removed"
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/fresh.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
rm -f "$TR/mnt/usb/lost.hc" "$TR/mnt/usb/fresh.hc"

# Properties of a favorite show the slot VeraCrypt lists for its volume,
# not the favorite's configured slot.
printf '2\t/mnt/usb/b.hc\t/dev/loop2\t/mnt/B2\n5\t/mnt/usb/a.hc\t/dev/loop5\t/mnt/A5\n' > "$TR/tmp/vcstub.state"
r=$(rpc run '{"action":"volume-properties","volume":"/mnt/usb/a.hc","slot":"2"}')
expect "properties of the listed slot" "$(field "$r" '@.output' | head -2 | tr '\n' ' ')" "Slot: 5 Volume: /mnt/usb/a.hc "
r=$(rpc run '{"action":"volume-properties","volume":"/mnt/usb/none.hc"}')
expect "properties of an unmounted volume" "$(field "$r" '@.error')" "/mnt/usb/none.hc is not mounted by VeraCrypt"
inroot 'rm -f /tmp/vcstub.state'

# Recovery of a hard-linked container whose name was removed meanwhile
# (e.g. an abort or a reboot): the container is linked back, never dropped.
mkdir -m 700 "$TR/mnt/usb/.vc-new.00000000000000bb"
printf 'keep\n' > "$TR/mnt/usb/.vc-new.00000000000000bb/gone.hc"
printf 'gone.hc\nl\n' > "$TR/mnt/usb/.vc-new.00000000000000bb/.vc-pin"
r=$(rpc run '{"action":"create","volume":"/mnt/usb/fresh2.hc","size":"1M","password":"x","filesystem":"none"}')
wait_job "$(field "$r" '@.job')" >/dev/null
expect "hard-linked container linked back at its name" "$(cat "$TR/mnt/usb/gone.hc" 2>/dev/null)" keep
[ -d "$TR/mnt/usb/.vc-new.00000000000000bb" ] && nok "recovered private directory removed" || ok "recovered private directory removed"
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/fresh2.hc"}'); wait_job "$(field "$r" '@.job')" >/dev/null
rm -f "$TR/mnt/usb/gone.hc" "$TR/mnt/usb/fresh2.hc"

# Header backups and keyfiles never replace an existing file.
printf 'precious\n' > "$TR/mnt/usb/precious.hc"
r=$(rpc run '{"action":"backup-headers","volume":"/mnt/usb/precious.hc","backup_file":"/mnt/usb/precious.hc","password":"x"}')
expect "backup over the volume itself refused" "$(field "$r" '@.error')" "the header backup file must not be the volume itself"
printf 'old\n' > "$TR/mnt/usb/old.bak"
r=$(rpc run '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/mnt/usb/old.bak","password":"x"}')
expect "backup over an existing file refused" "$(field "$r" '@.error')" "/mnt/usb/old.bak already exists; choose a new file name (or use force to overwrite)"
r=$(rpc run '{"action":"backup-headers","volume":"/mnt/usb/a.hc","backup_file":"/mnt/usb/old.bak","password":"x","force":"1"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "backup with force replaces the old file" "$(cat "$TR/mnt/usb/old.bak")" HEADERS
r=$(rpc run '{"action":"create-keyfile","volume":"/mnt/usb/precious.hc"}')
expect "keyfile over an existing file refused" "$(field "$r" '@.error')" "/mnt/usb/precious.hc already exists; choose a new file name"
expect "container untouched" "$(cat "$TR/mnt/usb/precious.hc")" precious
rm -f "$TR/mnt/usb/precious.hc" "$TR/mnt/usb/old.bak"

# Unmount everything only when asked to explicitly.
printf '4\t/mnt/usb/a.hc\t/dev/loop4\t/mnt/A4\n' > "$TR/tmp/vcstub.state"
r=$(rpc run '{"action":"unmount"}')
expect "empty unmount refused" "$(field "$r" '@.error')" "nothing to unmount: give a volume, mountpoint or slot (or all)"
expect "nothing unmounted" "$(cut -f2 "$TR/tmp/vcstub.state")" /mnt/usb/a.hc
r=$(rpc run '{"action":"unmount","all":"1"}'); wait_job "$(field "$r" '@.job')" >/dev/null
expect "unmount all with all=1" "$(cat "$TR/tmp/vcstub.state")" ""

# fsck Close leaves a mapping it did not create (the listed device must
# exist for the "already mapped" path; /dev/null stands in for it).
printf '7\t/mnt/usb/a.hc\t/dev/null\t-\n' > "$TR/tmp/vcstub.state"
r=$(rpc run '{"action":"fsck","volume":"/mnt/usb/a.hc","password":"x"}')
need_job "$r" "fsck of an already mapped volume"
r=$(wait_job "$J")
case $(field "$r" '@.output') in
	*"already mapped /dev/null"*) ok "fsck uses the existing mapping" ;;
	*) nok "fsck uses the existing mapping" "$r" ;;
esac
rpc job_dismount "{\"id\":\"$J\"}" >/dev/null
expect "existing mapping kept after fsck Close" "$(cut -f1 "$TR/tmp/vcstub.state")" 7
inroot 'rm -f /tmp/vcstub.state'
