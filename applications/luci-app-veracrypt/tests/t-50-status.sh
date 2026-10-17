# status: UCI volume sections via config_foreach, mount detection with spaces.
cat > "$TR/etc/config/veracrypt" <<'CFG'
config settings 'main'
	option timeout '300'

config volume 'media'
	option volume '/mnt/usb/a.hc'
	option mountpoint '/mnt/My Data'

config volume
	option volume '/mnt/usb/b.hc'
	option mountpoint '/mnt/B'
CFG
r=$(rpc status '{}')
expect "named section listed" "$(field "$r" '@.volumes[0].name')" media
expect "anonymous section listed" "$(field "$r" '@.volumes[1].volume')" /mnt/usb/b.hc
expect "not mounted when nothing is mounted" "$(field "$r" '@.volumes[0].mounted')" false
mkdir -p "$TR/mnt/My Data"
printf '{}' > "$TR/tmp/req.json"
r=$(inroot 'mount -t tmpfs tmpfs "/mnt/My Data" && /usr/libexec/rpcd/luci.veracrypt call status < /tmp/req.json')
expect "mountpoint with a space detected as mounted" "$(field "$r" '@.volumes[0].mounted')" true
printf "config settings 'main'\n\toption timeout '300'\n" > "$TR/etc/config/veracrypt"

# rm refuses a mount point (an empty directory otherwise removable), also
# when the path has a space.
mkdir -p "$TR/mnt/usb/vault 2"
printf '%s' '{"path":"/mnt/usb/vault 2"}' > "$TR/tmp/req.json"
r=$(inroot 'mount -t tmpfs tmpfs "/mnt/usb/vault 2" && /usr/libexec/rpcd/luci.veracrypt call rm < /tmp/req.json')
case $(field "$r" '@.error') in
	"refusing to delete /mnt/usb/vault 2 "*) ok "rm of a mount point (space in path) refused" ;;
	*) nok "rm of a mount point (space in path) refused" "got: $r" ;;
esac
