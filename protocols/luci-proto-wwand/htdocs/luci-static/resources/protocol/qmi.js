'use strict';
'require network';
'require protocol/wwand as wwand';

/* Back-compat alias. `qmi` is the historical proto name (the netifd shim still
   registers it via `add_protocol qmi`, so LuCI enumerates it from the ubus
   proto-handler list and loads this file for it). The full behaviour lives in
   protocol/wwand.js, which exposes its descriptor as WwandProto.descriptor; we
   register a SEPARATE `qmi` protocol from that same descriptor (a LuCI protocol
   module must return the constructor for the name it is loaded as — returning
   the wwand class here yields "invalid constructor"). New interfaces are saved
   as `proto wwand`; the label marks this one as the legacy alias in the picker. */
return network.registerProtocol('qmi', Object.assign({}, wwand.descriptor, {
	getI18n: function() {
		return _('Cellular / 5G (wwand — legacy "qmi")');
	}
}));
