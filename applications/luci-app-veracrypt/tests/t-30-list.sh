# veracrypt --list parsing (paths with spaces) and slot/volume matching.
LIST="1: /mnt/usb/a.hc /dev/mapper/veracrypt1 /mnt/A
2: '/mnt/usb/sub dir/c d.hc' /dev/mapper/veracrypt2 '/mnt/My Data'
3: '/mnt/usb/it''s x.hc' /dev/mapper/veracrypt3 -"
printf '%s\n' "$LIST" > "$TR/tmp/list.txt"
src='. /usr/libexec/rpcd/luci.veracrypt; L=$(cat /tmp/list.txt);'

expect "parse row with spaces" "$(inroot "$src"' vc_list_rows "$L" | sed -n 2p')" \
	"$(printf '2\t/mnt/usb/sub dir/c d.hc\t/dev/mapper/veracrypt2\t/mnt/My Data')"
expect "parse doubled quote" "$(inroot "$src"' vc_list_rows "$L" | sed -n 3p | cut -f2')" "/mnt/usb/it's x.hc"
expect "field by volume with spaces" "$(inroot "$src"' vc_list_field "/mnt/usb/sub dir/c d.hc" "" mp "$L"')" "/mnt/My Data"
expect "field by slot" "$(inroot "$src"' vc_list_field "" 1 vdev "$L"')" "/dev/mapper/veracrypt1"
expect "slot and volume must both match" "$(inroot "$src"' vc_list_field "/mnt/usb/a.hc" 2 mp "$L"')" ""
expect "matching slot and volume" "$(inroot "$src"' vc_list_field "/mnt/usb/a.hc" 1 mp "$L"')" "/mnt/A"
expect "no selector selects nothing" "$(inroot "$src"' vc_list_field "" "" mp "$L"')" ""

# status reports parsed fields per slot
inroot 'rm -f /tmp/vcstub.state'
r=$(rpc run '{"action":"mount","volume":"/mnt/usb/sub dir/c d.hc","mountpoint":"/mnt/My Data","password":"x"}')
wait_job "$(field "$r" '@.job')" >/dev/null
r=$(rpc status '{}')
expect "status slot volume with spaces" "$(field "$r" '@.slots[0].volume')" "/mnt/usb/sub dir/c d.hc"
expect "status slot mountpoint with spaces" "$(field "$r" '@.slots[0].mountpoint')" "/mnt/My Data"
expect "status next_slot" "$(field "$r" '@.next_slot')" 2

# unmount by volume path with spaces actually unmounts it
r=$(rpc run '{"action":"unmount","volume":"/mnt/usb/sub dir/c d.hc"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "unmount of volume with spaces succeeds" "$(field "$r" '@.ok')" true
r=$(rpc status '{}')
expect "no slots after unmount" "$(field "$r" '@.slots[0].slot')" ""
