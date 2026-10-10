# Candidate block devices, from a fake /sys/class/block and /dev.
rm -f "$TR/tmp/vcstub.state"
NODE=$(ls /dev/nvme0n1 /dev/sda /dev/vda /dev/mmcblk0 /dev/loop0 2>/dev/null | head -n 1)
blk() { # blk <name>: a block device in /sys and /dev
	mkdir -p "$TR/sys/class/block/$1/holders" "$TR/sys/class/block/$1/device"
	echo 2048 > "$TR/sys/class/block/$1/size"
	echo "8:$(printf '%s' "$1" | cksum | cut -c1-4)" > "$TR/sys/class/block/$1/dev"
	touch "$TR/dev/$1" && mount --bind "$NODE" "$TR/dev/$1"
}
for n in sda sda1 sda2 sdb sdc sdd sdd1 sdd2 sde sdg1 sdg2 sdh sdh1 sdh2 sdi sdi1 sdi2 mmcblk0 mmcblk0p1 mmcblk0boot0 mmcblk1 mmcblk1p1 nvme0n1 loop0; do
	blk "$n"
done
echo 4096 > "$TR/sys/class/block/sdb/size"
echo "Ultra Fit " > "$TR/sys/class/block/sdb/device/model"
echo MMC > "$TR/sys/class/block/mmcblk0/device/type"
echo SD > "$TR/sys/class/block/mmcblk1/device/type"
mkdir -p "$TR/sys/class/block/vda" "$TR/sys/class/block/sdf"
: > "$TR/dev/sdf"
mkdir "$TR/sys/class/block/sdc/holders/dm-0" "$TR/sys/class/block/sdi2/holders/dm-1"
# sda1 mounted by name, sdd1 by device number (/mnt/usb is mounted as "/dev/root")
mkdir -p "$TR/mnt/sda1"
mount -t tmpfs /dev/sda1 "$TR/mnt/sda1"
/usr/sbin/chroot "$TR" /usr/bin/ucode -e 'import { stat } from "fs"; const d = stat("/mnt/usb").dev; print(`${d.major}:${d.minor}\n`);' \
	> "$TR/sys/class/block/sdd1/dev"
# sdg1 is swap
printf 'Filename\t\tType\tSize\tUsed\tPriority\n/dev/sdg1\tpartition\t1024\t0\t-2\n' > "$TR/tmp/swaps"
mount --bind "$TR/tmp/swaps" "$TR/proc/swaps"
printf '1\t/dev/sde\t/dev/mapper/veracrypt1\t/mnt/E\tNo\n' > "$TR/tmp/vcstub.state"

r=$(rpc devices)
expect "candidate devices" "$(field "$r" '@.devices[*].path' | tr '\n' ' ')" "/dev/mmcblk1p1 /dev/nvme0n1 /dev/sdb /dev/sdh1 /dev/sdh2 "
expect "device size in bytes" "$(field "$r" '@.devices[2].size')" 2097152
expect "device model" "$(field "$r" '@.devices[2].name')" "Ultra Fit"

# Only candidates can be mounted or overwritten.
r=$(rpc mount '{"volume":"/dev/sdh2","mountpoint":"/mnt/D","password":"x"}')
expect "mounting a candidate partition starts" "$(field "$r" '@.started')" true
wait_job > /dev/null
# Every partition of a disk with a used one is refused: sda (sda1 mounted),
# sdd (sdd1 mounted as /dev/root), sdg (sdg1 swap), sdi (sdi2 held), sdh
# (sdh2 now a veracrypt volume).
for d in sda sda1 sda2 sdc sdd sdd1 sdd2 sde sdg1 sdg2 sdh sdh1 sdh2 sdi sdi1 sdi2 mmcblk0 mmcblk0p1 mmcblk0boot0 loop0 vda sdf; do
	r=$(rpc create "{\"device\":true,\"volume\":\"/dev/$d\",\"password\":\"x\"}")
	expect_error "create on /dev/$d refused" "$r" "not an unused block device"
done
r=$(rpc devices)
expect "a disk veracrypt uses is no candidate" "$(field "$r" '@.devices[*].path' | grep -c sdh)" 0
r=$(rpc create '{"device":true,"volume":"/dev/sdb","password":"x","size":"1G"}')
expect "create on a whole free disk starts" "$(field "$r" '@.started')" true
wait_job > /dev/null
args=$(last_argv)
expect "device create has no --size" "$args" "--text|--non-interactive|--stdin|--create|--volume-type=normal|--random-source=/dev/urandom|--encryption=AES|--hash=SHA-512|--filesystem=fat|/dev/sdb"

umount "$TR/mnt/sda1" "$TR/proc/swaps"
