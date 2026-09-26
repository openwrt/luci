# Prompt-driven change / backup-headers / restore-headers.
PWS=S3cretOldPass
rpc_env() { # rpc_env <env assignments> <method> <json>
	printf '%s' "$3" > "$TR/tmp/req.json"
	inroot "$1 /usr/libexec/rpcd/luci.veracrypt call $2 < /tmp/req.json"
}
dialog_job() { # dialog_job <env> <json>: final job reply
	r=$(rpc_env "$1" run "$2")
	j=$(field "$r" '@.job')
	[ -n "$j" ] || { printf '%s' "$r"; return; }
	n=0
	while [ "$n" -lt 40 ]; do
		r=$(rpc job "{\"id\":\"$j\"}")
		[ "$(field "$r" '@.pending')" = true ] || break
		n=$((n + 1)); sleep 1
	done
	field "$(rpc job_log "{\"id\":\"$j\"}")" '@.output' > "$TR/tmp/lastlog"
	printf '%s' "$r"
}
LASTLOG=
nolog_secret() { # nolog_secret <desc> <secret>
	LASTLOG=$(cat "$TR/tmp/lastlog" 2>/dev/null)
	case $LASTLOG in *"$2"*) nok "$1" "secret found in log" ;; *) ok "$1" ;; esac
}
inroot 'rm -f /tmp/vcstub.*'

r=$(dialog_job "VCSTUB_PW=$PWS" "{\"action\":\"change\",\"volume\":\"/mnt/usb/a.hc\",\"password\":\"$PWS\",\"new_password\":\"NewShort1\"}")
expect "change password (short new password confirmed)" "$(field "$r" '@.ok')" true
expect "new password reached veracrypt" "$(cat "$TR/tmp/vcstub.newpw" 2>/dev/null)" NewShort1
nolog_secret "old password not in job log" "$PWS"
nolog_secret "new password not in job log" NewShort1

r=$(dialog_job "VCSTUB_PW=$PWS" '{"action":"change","volume":"/mnt/usb/a.hc","password":"wrong","new_password":"NewShort1"}')
expect "change with wrong password fails" "$(field "$r" '@.ok')" false
LASTLOG=$(cat "$TR/tmp/lastlog"); case $LASTLOG in *"wrong password"*) ok "wrong password is reported" ;; *) nok "wrong password is reported" "$LASTLOG" ;; esac

r=$(dialog_job "VCSTUB_PW=$PWS" "{\"action\":\"backup-headers\",\"volume\":\"/mnt/usb/a.hc\",\"password\":\"$PWS\",\"keyfiles\":\"/mnt/usb/k1,/mnt/usb/k,,2\",\"backup_file\":\"/mnt/usb/hdr.bak\"}")
expect "backup-headers succeeds" "$(field "$r" '@.ok')" true
expect "backup file written" "$(cat "$TR/mnt/usb/hdr.bak" 2>/dev/null)" HEADERS
expect "keyfiles answered one by one (,, unescaped)" "$(tr '\n' '|' < "$TR/tmp/vcstub.kf")" "/mnt/usb/k1|/mnt/usb/k,2|"
nolog_secret "backup: password not in job log" "$PWS"

r=$(dialog_job "VCSTUB_PW=$PWS" "{\"action\":\"backup-headers\",\"volume\":\"/mnt/usb/a.hc\",\"password\":\"$PWS\",\"protection_password\":\"HiddenPw9\",\"backup_file\":\"/mnt/usb/hdr2.bak\"}")
expect "backup-headers with hidden volume succeeds" "$(field "$r" '@.ok')" true
expect "hidden password went to the hidden prompt" "$(cat "$TR/tmp/vcstub.hiddenpw" 2>/dev/null)" HiddenPw9

r=$(dialog_job "VCSTUB_PW=$PWS" "{\"action\":\"restore-headers\",\"volume\":\"/mnt/usb/a.hc\",\"password\":\"$PWS\",\"backup_file\":\"/mnt/usb/hdr.bak\"}")
expect "restore-headers from backup file succeeds" "$(field "$r" '@.ok')" true
nolog_secret "restore: password not in job log" "$PWS"

r=$(dialog_job "VCSTUB_PW=$PWS VCSTUB_WEIRD=1" "{\"action\":\"change\",\"volume\":\"/mnt/usb/a.hc\",\"password\":\"$PWS\",\"new_password\":\"NewShort1\"}")
expect "unexpected prompt aborts" "$(field "$r" '@.ok')" false
LASTLOG=$(cat "$TR/tmp/lastlog"); case $LASTLOG in *"unexpected prompt"*) ok "unexpected prompt is reported" ;; *) nok "unexpected prompt is reported" "$LASTLOG" ;; esac
