# Mount: mount directory rules, argument validation, the job, status, unmount.
rm -f "$TR/tmp/vcstub.state"
mkdir -p "$TR/mnt/full" "$TR/mnt/empty" "$TR/mnt/inuse"
: > "$TR/mnt/full/f"
: > "$TR/mnt/usb/b.hc"
ln -s /etc "$TR/mnt/etc"
mount -t tmpfs -o mode=755 x "$TR/mnt/inuse"

mp() { # mp <desc> <mountpoint> <part of the expected error>
	r=$(rpc mount "{\"volume\":\"/mnt/usb/b.hc\",\"mountpoint\":\"$2\",\"password\":\"x\"}")
	expect_error "$1" "$r" "$3"
}
mp "mount directory below a disk refused" /mnt/usb/x "must be /mnt/<name>"
mp "mount directory outside /mnt refused" /tmp/x "must be /mnt/<name>"
mp "mount directory '..' refused" /mnt/.. "must be /mnt/<name>"
mp "mount directory with a space refused" "/mnt/a b" "must be /mnt/<name>"
mp "65-character mount directory name refused" "/mnt/$(printf '%065d' 0)" "must be /mnt/<name>"
mp "mount directory that is a symlink refused" /mnt/etc "must be an empty directory"
mp "non-empty mount directory refused" /mnt/full "must be an empty directory"
mp "mount directory that is a mounted disk refused" /mnt/usb "must be an empty directory"
mp "mount directory with something mounted refused" /mnt/inuse "must be an empty directory"
mp "mount directory that is a file refused" /mnt/full/f "must be /mnt/<name>"

arg() { # arg <desc> <extra json members> <part of the expected error>
	r=$(rpc mount "{\"volume\":\"/mnt/usb/b.hc\",\"mountpoint\":\"/mnt/B\",\"password\":\"x\",$2}")
	expect_error "$1" "$r" "$3"
}
arg "PIM below 0 refused" '"pim":-1' "Invalid PIM"
arg "PIM above 2147468 refused" '"pim":2147469' "Invalid PIM"
arg "PIM as a string refused" '"pim":"5"' "Invalid PIM"
arg "slot 0 refused" '"slot":0' "Invalid slot"
arg "slot 65 refused" '"slot":65' "Invalid slot"
r=$(rpc mount '{"volume":"/mnt/usb/b.hc","mountpoint":"/mnt/B","password":"a\nb"}')
expect_error "password with a line break refused" "$r" "single line"
r=$(rpc mount '{"volume":"/mnt/usb/b.hc","mountpoint":"/mnt/B","password":"a\rb"}')
expect_error "password with a carriage return refused" "$r" "single line"
r=$(rpc mount "{\"volume\":\"/mnt/usb/b.hc\",\"mountpoint\":\"/mnt/B\",\"password\":\"$(printf '%0129d' 0)\"}")
expect_error "password over 128 bytes refused" "$r" "128 bytes"
r=$(rpc mount '{"volume":"/mnt/usb/b.hc","mountpoint":"/mnt/B"}')
expect_error "missing password refused" "$r" "single line"
r=$(rpc mount '{"volume":"/dev/sda1","mountpoint":"/mnt/B","password":"x"}')
expect_error "device that is not a candidate refused" "$r" "not an unused block device"

# A volume path with spaces, quotes and backslashes.
VOL="/mnt/usb/my 'vol' \"q\" \\x.hc"
: > "$TR$VOL"
JVOL='/mnt/usb/my '"'"'vol'"'"' \"q\" \\x.hc'
VCSTUB_PW='Secret 1'
r=$(rpc mount "{\"volume\":\"$JVOL\",\"mountpoint\":\"/mnt/B\",\"password\":\"Secret 1\",\"pim\":7,\"slot\":5,\"readonly\":true,\"keyfiles\":[\"/mnt/usb/key\"]}")
expect "mount starts a job" "$(field "$r" '@.started')" true
[ -d "$TR/mnt/B" ] && ok "mount directory created" || nok "mount directory created"
r=$(wait_job)
VCSTUB_PW=x
expect "mount job succeeded" "$(field "$r" '@.rc')" 0
expect "job op names the volume" "$(field "$r" '@.op')" "mount $VOL"
expect "job is not running" "$(field "$r" '@.running')" false
args=$(last_argv)
expect "veracrypt argv" "$args" "--text|--non-interactive|--stdin|--pim=7|--keyfiles=/mnt/usb/key|--slot=5|--mount-options=ro|$VOL|/mnt/B"
expect "password given on stdin" "$(cat "$TR/tmp/vcstub.stdin")" "Secret 1"
grep -q "Secret 1" "$TR/tmp/vcstub.argv" && nok "password not in argv" || ok "password not in argv"
# (VCSTUB_PW is the stub's own copy of the expected password.)
grep -v ^VCSTUB_ "$TR/tmp/vcstub.env" | grep -q "Secret 1" && nok "password not in the environment" || ok "password not in the environment"
grep -rq "Secret 1" "$TR/var/run/luci-veracrypt-lite" && nok "password not in the job files" || ok "password not in the job files"

r=$(rpc status)
expect "status version" "$(field "$r" '@.version')" 1.26.24
expect "status slot" "$(field "$r" '@.slots[0].slot')" 5
expect "status volume with quotes and backslashes" "$(field "$r" '@.slots[0].volume')" "$VOL"
expect "status virtual device" "$(field "$r" '@.slots[0].vdev')" /dev/mapper/veracrypt5
expect "status mount directory" "$(field "$r" '@.slots[0].mountpoint')" /mnt/B
expect "status size" "$(field "$r" '@.slots[0].size')" "64.0 MiB"
expect "status type" "$(field "$r" '@.slots[0].type')" Normal
expect "status read-only" "$(field "$r" '@.slots[0].readonly')" true
expect "status job" "$(field "$r" '@.job.rc')" 0
expect "status ignores other labels" "$(field "$r" '@.slots[0]["Encryption Algorithm"]')" ""

# A second volume, then unmount exactly one slot.
printf '3\t/mnt/usb/Slot: 9.hc\t/dev/loop0\t/mnt/C\tNo\n' >> "$TR/tmp/vcstub.state"
r=$(rpc status)
expect "two slots listed" "$(field "$r" '@.slots[1].slot')" 3
expect "volume named like a label parsed" "$(field "$r" '@.slots[1].volume')" "/mnt/usb/Slot: 9.hc"
expect "read-only No is false" "$(field "$r" '@.slots[1].readonly')" false
r=$(rpc unmount '{"slot":3}')
expect "unmount returns the exit code" "$(field "$r" '@.code')" 0
expect "unmount uses the exact slot" "$(tail -n 2 "$TR/tmp/vcstub.argv" | head -n 1)" --slot=3
r=$(rpc status)
expect "other slot still mounted" "$(field "$r" '@.slots[*].slot')" 5
r=$(rpc unmount '{"slot":3}')
expect "unmounting a free slot fails" "$(field "$r" '@.code')" 1
expect "unmount returns the output" "$(field "$r" '@.output')" "Error: No such volume is mounted."
r=$(rpc unmount '{}')
expect_error "unmount without a slot refused" "$r" "No slot"
r=$(rpc unmount '{"slot":"5"}')
expect_error "unmount with a string slot refused" "$r" "Invalid slot"
r=$(rpc unmount '{"slot":5,"force":true}')
expect "forced unmount passes --force" "$(tail -n 2 "$TR/tmp/vcstub.argv" | head -n 1)" --force
r=$(rpc status)
expect "no slots after unmount" "$(field "$r" '@.slots')" "[ ]"

# Mount via the job: a wrong password fails with rc and log.
r=$(rpc mount '{"volume":"/mnt/usb/b.hc","mountpoint":"/mnt/empty","password":"wrong","nokernelcrypto":true}')
r=$(wait_job)
expect "wrong password: job rc 1" "$(field "$r" '@.rc')" 1
expect "wrong password: log" "$(field "$r" '@.log')" "Error: Incorrect password or not a VeraCrypt volume."
expect "nokernelcrypto passed" "$(grep -c '^--mount-options=nokernelcrypto$' "$TR/tmp/vcstub.argv")" 1
[ -d "$TR/mnt/empty" ] && ok "failed mount keeps a mount directory it did not make" || nok "failed mount keeps a mount directory it did not make"
r=$(rpc mount '{"volume":"/mnt/usb/b.hc","mountpoint":"/mnt/W","password":"wrong","readonly":true,"nokernelcrypto":true}')
[ -d "$TR/mnt/W" ] && ok "mount directory made for the job" || nok "mount directory made for the job"
r=$(wait_job)
expect "wrong password into a new directory: rc 1" "$(field "$r" '@.rc')" 1
[ -e "$TR/mnt/W" ] && nok "failed mount removes the directory it made" || ok "failed mount removes the directory it made"
expect "ro and nokernelcrypto passed together" "$(grep -c '^--mount-options=ro,nokernelcrypto$' "$TR/tmp/vcstub.argv")" 1
umount "$TR/mnt/inuse"
