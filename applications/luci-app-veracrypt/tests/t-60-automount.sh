# auto-mount is done by the app, confined to /mnt, not by veracrypt --auto-mount.
inroot 'rm -f /tmp/vcstub.state'
cat > "$TR/etc/config/veracrypt" <<'CFG'
config settings 'main'
	option timeout '300'

config volume 'good'
	option volume '/mnt/usb/a.hc'
	option mountpoint '/mnt/Good'

config volume 'evil'
	option volume '/mnt/usb/b.hc'
	option mountpoint '/etc'
CFG
r=$(rpc run '{"action":"auto-mount","auto_mount":"favorites","password":"x"}')
r=$(wait_job "$(field "$r" '@.job')")
[ "$(field "$r" '@.ok')" = true ] && ok "auto-mount favorites succeeds" || nok "auto-mount favorites succeeds" "$r"
st=$(cat "$TR/tmp/vcstub.state")
case $st in *"/mnt/usb/a.hc"*"/mnt/Good"*) ok "favorite mounted on its mountpoint" ;; *) nok "favorite mounted on its mountpoint" "$st" ;; esac
case $st in *"/etc"*) nok "favorite with mountpoint /etc skipped" "$st" ;; *) ok "favorite with mountpoint /etc skipped" ;; esac
case $(field "$r" '@.output') in *"skipped evil"*) ok "skip is reported" ;; *) nok "skip is reported" "$r" ;; esac

inroot 'rm -f /tmp/vcstub.state'
r=$(rpc run '{"action":"auto-mount","auto_mount":"devices","password":"x"}')
need_job "$r" "auto-mount devices with no eligible disk"
r=$(wait_job "$J")
expect "auto-mount devices with no eligible disk reports failure" "$(field "$r" '@.ok')" false
printf "config settings 'main'\n\toption timeout '300'\n" > "$TR/etc/config/veracrypt"
