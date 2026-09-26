# create reports the status of its follow-up mount.
inroot 'rm -f /tmp/vcstub.state /tmp/vcstub.fail.mount'
r=$(rpc run '{"action":"create","volume":"/mnt/usb/new1.hc","size":"1M","password":"x","filesystem":"none"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "create + map succeeds" "$(field "$r" '@.ok')" true

inroot 'touch /tmp/vcstub.fail.mount'
r=$(rpc run '{"action":"create","volume":"/mnt/usb/new2.hc","size":"1M","password":"x","filesystem":"ext4"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "create reports failure when the mount fails" "$(field "$r" '@.ok')" false
r=$(rpc run '{"action":"create","volume":"/mnt/usb/new3.hc","size":"1M","password":"x","filesystem":"none"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "create reports failure when mapping fails (filesystem=none)" "$(field "$r" '@.ok')" false
inroot 'rm -f /tmp/vcstub.fail.mount'

inroot 'touch /tmp/vcstub.fail.create'
r=$(rpc run '{"action":"create","volume":"/mnt/usb/new4.hc","size":"1M","password":"x"}')
r=$(wait_job "$(field "$r" '@.job')")
expect "create reports failure when creation fails" "$(field "$r" '@.ok')" false
inroot 'rm -f /tmp/vcstub.fail.create'

# The inner filesystem is formatted through FUSE: dmsetup is not packaged.
case $(cat "$TR/tmp/vcstub.createargs" 2>/dev/null) in
	*--mount-options=nokernelcrypto*) ok "create formats with nokernelcrypto" ;;
	*) nok "create formats with nokernelcrypto" "$(cat "$TR/tmp/vcstub.createargs" 2>/dev/null)" ;;
esac
