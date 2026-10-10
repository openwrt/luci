# Path rules for new files (create_keyfile, create) and existing ones (mount).
mkdir -p "$TR/mnt/usb/dir" "$TR/mnt/usb/open" "$TR/mnt/usb/group" "$TR/mnt/usb/real"
chmod 777 "$TR/mnt/usb/open"
chmod 775 "$TR/mnt/usb/group"
: > "$TR/mnt/usb/a.hc"
: > "$TR/mnt/usb/key"
ln -s /etc "$TR/mnt/usb/etclink"
ln -s /etc/passwd "$TR/mnt/usb/passwd"
ln -s /mnt/usb/real "$TR/mnt/usb/inside"
ln -s /mnt/usb/gone "$TR/mnt/usb/dangling"

newfile() { # newfile <desc> <path> <part of the expected error>
	r=$(rpc create_keyfile "{\"path\":\"$2\"}")
	expect_error "$1" "$r" "$3"
}

newfile "keyfile outside /mnt refused" /etc/vc.key "Invalid path"
newfile "relative path refused" mnt/usb/k "Invalid path"
newfile "'..' segment refused" /mnt/usb/../usb/k "Invalid path"
newfile "'.' segment refused" /mnt/usb/./k "Invalid path"
newfile "trailing slash refused" /mnt/usb/k/ "Invalid path"
newfile "',' refused (keyfile list separator)" /mnt/usb/a,b "Invalid path"
newfile "control character refused" '/mnt/usb/a\u0001b' "Invalid path"
newfile "line break refused" '/mnt/usb/a\nb' "Invalid path"
newfile "directory /mnt itself refused" /mnt/k "outside /mnt"
newfile "directory symlinked to /etc refused" /mnt/usb/etclink/k "outside /mnt"
newfile "missing directory refused" /mnt/usb/nodir/k "does not exist"
newfile "directory on the root filesystem refused" /mnt/flash/k "not on a mounted disk"
newfile "existing file refused" /mnt/usb/a.hc "already exists"
newfile "dangling symlink refused" /mnt/usb/dangling "already exists"
newfile "symlink to /etc/passwd refused" /mnt/usb/passwd "already exists"
newfile "world-writable directory refused" /mnt/usb/open/k "writable by other users"
newfile "group-writable directory refused" /mnt/usb/group/k "writable by other users"

r=$(rpc create_keyfile '{"path":"/mnt/usb/inside/new.key"}')
expect "keyfile through a symlink inside /mnt is created" "$(field "$r" '@.code')" 0
[ -s "$TR/mnt/usb/real/new.key" ] && ok "keyfile written at the resolved path" || nok "keyfile written at the resolved path"
expect "veracrypt got the resolved path" "$(grep -c '^/mnt/usb/real/new.key$' "$TR/tmp/vcstub.argv")" 1
r=$(rpc create_keyfile '{"path":"/mnt/usb/dir/it'"'"'s $(id) `x`.key"}')
expect "keyfile name with quotes and shell syntax" "$(field "$r" '@.code')" 0
[ -s "$TR/mnt/usb/dir/it's \$(id) \`x\`.key" ] && ok "name with quotes reaches veracrypt unchanged" || nok "name with quotes reaches veracrypt unchanged" "$(ls "$TR/mnt/usb/dir")"
r=$(rpc create_keyfile '{"path":"/mnt/usb/dir/new.key"}')
expect "keyfile output returned" "$(field "$r" '@.output')" "Keyfile created."
r=$(rpc create_keyfile '{"path":5}')
expect_error "non-string path refused" "$r" "Invalid path"

# Existing files: a volume to mount.
mnt() { # mnt <desc> <volume> <part of the expected error>
	r=$(rpc mount "{\"volume\":\"$2\",\"mountpoint\":\"/mnt/vc\",\"password\":\"x\"}")
	expect_error "$1" "$r" "$3"
}
mnt "volume outside /mnt refused" /etc/passwd "Invalid path"
mnt "volume symlinked to /etc/passwd refused" /mnt/usb/passwd "outside /mnt"
mnt "volume via directory symlink to /etc refused" /mnt/usb/etclink/passwd "outside /mnt"
mnt "missing volume refused" /mnt/usb/none.hc "does not exist"
mnt "directory as volume refused" /mnt/usb/dir "is not a file"
r=$(rpc mount '{"volume":"/mnt/usb/a.hc","mountpoint":"/mnt/vc","password":"x","keyfiles":["/mnt/usb/passwd"]}')
expect_error "keyfile symlinked to /etc/passwd refused" "$r" "outside /mnt"
r=$(rpc mount '{"volume":"/mnt/usb/a.hc","mountpoint":"/mnt/vc","password":"x","keyfiles":["/mnt/flash/../usb/key"]}')
expect_error "keyfile with '..' refused" "$r" "Invalid path"
r=$(rpc mount '{"volume":"/mnt/usb/a.hc","mountpoint":"/mnt/vc","password":"x","keyfiles":"/mnt/usb/key"}')
expect_error "keyfiles must be a list" "$r" "Invalid keyfile list"
[ -e "$TR/mnt/vc" ] && nok "refused mounts create no mount directory" || ok "refused mounts create no mount directory"

# Symlinks to names with a line break or ',' (they would add lines to the job
# helper's input or split --keyfiles) are refused after resolving.
NL='
'
mkdir -p "$TR/mnt/usb/k$NL--token-lib=/mnt/usb/evil.so" "$TR/mnt/usb/nl$NL"
: > "$TR/mnt/usb/k$NL--token-lib=/mnt/usb/evil.so/f"
: > "$TR/mnt/usb/c,d"
: > "$TR/mnt/usb/v$NL.hc"
ln -s "/mnt/usb/k$NL--token-lib=/mnt/usb/evil.so/f" "$TR/mnt/usb/nlkey"
ln -s /mnt/usb/c,d "$TR/mnt/usb/commakey"
ln -s "/mnt/usb/v$NL.hc" "$TR/mnt/usb/nlvol"
ln -s "/mnt/usb/nl$NL" "$TR/mnt/usb/nldir"
rm -f "$TR/tmp/vcstub.argv"
r=$(rpc mount '{"volume":"/mnt/usb/a.hc","mountpoint":"/mnt/Q","password":"x","keyfiles":["/mnt/usb/nlkey"]}')
expect_error "keyfile symlink to a name with a line break refused" "$r" "control character"
r=$(rpc mount '{"volume":"/mnt/usb/a.hc","mountpoint":"/mnt/Q","password":"x","keyfiles":["/mnt/usb/commakey"]}')
expect_error "keyfile symlink to a name with ',' refused" "$r" "control character or \",\""
r=$(rpc mount '{"volume":"/mnt/usb/nlvol","mountpoint":"/mnt/Q","password":"x"}')
expect_error "volume symlink to a name with a line break refused" "$r" "control character"
r=$(rpc create '{"volume":"/mnt/usb/nldir/c.hc","size":"1M","password":"x"}')
expect_error "create in a directory whose real path has a line break refused" "$r" "control character"
r=$(rpc create_keyfile '{"path":"/mnt/usb/nldir/k"}')
expect_error "keyfile in a directory whose real path has a line break refused" "$r" "control character"
r=$(rpc create '{"volume":"/mnt/usb/c.hc","size":"1M","password":"x","keyfiles":["/mnt/usb/nlkey"]}')
expect_error "create with a keyfile symlink to a line break refused" "$r" "control character"
expect "veracrypt never ran for them" "$(cat "$TR/tmp/vcstub.argv" 2>/dev/null)" ""
[ -e "$TR/mnt/Q" ] && nok "no mount directory for refused mounts" || ok "no mount directory for refused mounts"
expect "nothing created in the line-break directory" "$(ls -A "$TR/mnt/usb/nl$NL")" ""

# The helper itself refuses input the plugin never sends.
helper() { # helper <desc> <stdin>
	r=$(printf '%b' "$2" | /usr/sbin/chroot "$TR" /usr/libexec/luci-veracrypt-lite-job; echo $?)
	expect "$1" "$r" 2
}
helper "helper refuses an unknown operation" 'format /mnt/usb/a.hc\nx\n/mnt/usb/a.hc\n'
helper "helper refuses an empty argument" 'mount /mnt/usb/a.hc\nx\n\n/mnt/usb/a.hc\n/mnt/Q\n'
for o in --token-lib=/mnt/usb/evil.so --token-pin=1 --password=x --new-password=x --protection-password=x; do
	helper "helper refuses $o" "mount /mnt/usb/a.hc\\nx\\n$o\\n/mnt/usb/a.hc\\n/mnt/Q\\n"
done
expect "helper started nothing" "$(cat "$TR/tmp/vcstub.argv" 2>/dev/null)" ""
[ -e "$TR/mnt/Q" ] && nok "helper made no mount directory" || ok "helper made no mount directory"
