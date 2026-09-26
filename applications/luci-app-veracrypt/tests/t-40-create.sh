# create reports the status of its follow-up mount.
inroot 'rm -f /tmp/vcstub.state /tmp/vcstub.fail.mount'
r=$(rpc run '{"action":"create","volume":"/mnt/usb/new1.hc","size":"1M","password":"x","filesystem":"none"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "create + map succeeds" "$(field "$r" '@.ok')" true

inroot 'touch /tmp/vcstub.fail.mount'
r=$(rpc run '{"action":"create","volume":"/mnt/usb/new2.hc","size":"1M","password":"x","filesystem":"ext4"}')
need_job "$r" "create reports failure when the mount fails"
r=$(wait_job "$J")
expect "create reports failure when the mount fails" "$(field "$r" '@.ok')" false
r=$(rpc run '{"action":"create","volume":"/mnt/usb/new3.hc","size":"1M","password":"x","filesystem":"none"}')
need_job "$r" "create reports failure when mapping fails (filesystem=none)"
r=$(wait_job "$J")
expect "create reports failure when mapping fails (filesystem=none)" "$(field "$r" '@.ok')" false
inroot 'rm -f /tmp/vcstub.fail.mount'

inroot 'touch /tmp/vcstub.fail.create'
r=$(rpc run '{"action":"create","volume":"/mnt/usb/new4.hc","size":"1M","password":"x"}')
need_job "$r" "create reports failure when creation fails"
r=$(wait_job "$J")
expect "create reports failure when creation fails" "$(field "$r" '@.ok')" false
inroot 'rm -f /tmp/vcstub.fail.create'

# The inner filesystem is formatted through FUSE: dmsetup (lvm2) is not needed.
case $(cat "$TR/tmp/vcstub.createargs" 2>/dev/null) in
	*--mount-options=nokernelcrypto*) ok "create formats with nokernelcrypto" ;;
	*) nok "create formats with nokernelcrypto" "$(cat "$TR/tmp/vcstub.createargs" 2>/dev/null)" ;;
esac
