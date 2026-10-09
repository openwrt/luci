# Create: a container file or a device, option allowlists, formatter check.
cr() { # cr <desc> <extra json members> <part of the expected error>
	r=$(rpc create "{\"volume\":\"/mnt/usb/c.hc\",\"size\":\"10M\",\"password\":\"x\",$2}")
	expect_error "$1" "$r" "$3"
}
cr "unknown encryption refused" '"encryption":"ROT13"' "Unsupported encryption"
cr "encryption with an option refused" '"encryption":"AES --force"' "Unsupported encryption"
cr "unknown hash refused" '"hash":"md5"' "Unsupported hash"
cr "unknown filesystem refused" '"filesystem":"btrfs"' "Unsupported filesystem"
cr "filesystem without its formatter refused" '"filesystem":"exfat"' "mkfs.exfat is not installed"
cr "size 0 refused" '"size":"0"' "Invalid size"
cr "size with a unit word refused" '"size":"10MB"' "Invalid size"
cr "negative size refused" '"size":"-1G"' "Invalid size"
cr "size as a number refused" '"size":10' "Invalid size"
cr "PIM out of range refused" '"pim":3000000' "Invalid PIM"
r=$(rpc create '{"volume":"/mnt/flash/c.hc","size":"10M","password":"x"}')
expect_error "container on the root filesystem refused" "$r" "not on a mounted disk"
r=$(rpc create '{"volume":"/mnt/usb/a.hc","size":"10M","password":"x"}')
expect_error "existing container refused" "$r" "already exists"
r=$(rpc create '{"volume":"/mnt/usb/c.hc","size":"10M","password":"a\nb"}')
expect_error "password with a line break refused" "$r" "single line"

r=$(rpc create '{"volume":"/mnt/usb/c.hc","size":"10M","password":"x","pim":0,"encryption":"Serpent-Twofish-AES","hash":"BLAKE2s-256","filesystem":"none","quick":true,"keyfiles":["/mnt/usb/key"]}')
expect "create starts a job" "$(field "$r" '@.started')" true
r=$(wait_job)
expect "create job succeeded" "$(field "$r" '@.rc')" 0
expect "create job op" "$(field "$r" '@.op')" "create /mnt/usb/c.hc"
case $(field "$r" '@.log') in *"successfully created"*) ok "create log returned" ;; *) nok "create log returned" "$r" ;; esac
[ -e "$TR/mnt/usb/c.hc" ] && ok "container created" || nok "container created"
args=$(last_argv)
expect "create argv" "$args" "--text|--non-interactive|--stdin|--create|--volume-type=normal|--random-source=/dev/urandom|--encryption=Serpent-Twofish-AES|--hash=BLAKE2s-256|--filesystem=none|--size=10M|--quick|--pim=0|--keyfiles=/mnt/usb/key|/mnt/usb/c.hc"

r=$(rpc create '{"volume":"/mnt/usb/d.hc","size":"1G","password":"x"}')
wait_job > /dev/null
args=$(last_argv)
expect "create defaults: AES, SHA-512, FAT" "$args" "--text|--non-interactive|--stdin|--create|--volume-type=normal|--random-source=/dev/urandom|--encryption=AES|--hash=SHA-512|--filesystem=fat|--size=1G|/mnt/usb/d.hc"

expect "status reports mkfs.exfat missing" "$(field "$(rpc status)" '@.tools["mkfs.exfat"]')" false
printf '#!/bin/sh\n' > "$TR/usr/sbin/mkfs.exfat"
chmod 755 "$TR/usr/sbin/mkfs.exfat"
r=$(rpc create '{"volume":"/mnt/usb/e.hc","size":"1M","password":"x","filesystem":"exfat"}')
expect "exFAT accepted once mkfs.exfat is installed" "$(field "$r" '@.started')" true
wait_job > /dev/null
expect "status reports mkfs.exfat" "$(field "$(rpc status)" '@.tools["mkfs.exfat"]')" true
rm -f "$TR/usr/sbin/mkfs.exfat"

r=$(rpc create '{"volume":"/mnt/usb/f.hc","size":"1M","password":"wrong"}')
r=$(wait_job)
expect "failed create reports its rc" "$(field "$r" '@.rc')" 1

r=$(rpc create '{"device":true,"volume":"/dev/sda","password":"x"}')
expect_error "device create needs a candidate device" "$r" "not an unused block device"
r=$(rpc create '{"device":true,"volume":"/mnt/usb/g.hc","password":"x"}')
expect_error "device create with a file path refused" "$r" "not an unused block device"
