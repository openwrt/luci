'use strict';
'require baseclass';
'require rpc';

/* Every ubus rpc.declare() used by the wwand LuCI packages, collected once so
   the method/params/expect triples are not copy-pasted across the views, the
   proto handler and the shared modules.

   IMPORTANT — ACLs: a method added here must be granted in BOTH rpcd ACL
   files, luci-app-wwand/root/usr/share/rpcd/acl.d/luci-app-wwand.json AND
   luci-proto-wwand/root/usr/share/rpcd/acl.d/luci-proto-wwand.json, whenever
   it is reachable from a shared module (wwand.modemopts / wwand.modemsid are
   loaded by both packages) or from the proto handler. Methods used only by
   the app views need only the app ACL. */

/* A write whose call ubus itself refuses — an argument the method does not
   declare or with another type (INVALID_ARGUMENT), a method a newer LuCI
   knows and an older daemon does not (METHOD_NOT_FOUND) — reaches rpc.js as
   a bare status code in the legacy `call` result, which `expect: {}` then
   replaces with an empty object (luci-base rpc.js:92-105, luci feeds
   4b6dda1a). The views read `ok === false` as failure and anything else as
   success, so every such refusal was reported as done. `reject` makes the
   status an error, and this turns it into the answer shape they already
   handle. Reads stay as they are: their callers render an empty result. */
function checked(decl) {
	var call = rpc.declare(Object.assign({ reject: true }, decl));

	return function() {
		return call.apply(this, arguments).catch(function(e) {
			return { ok: false, error: (e && e.message) ? e.message : String(e) };
		});
	};
}

return baseclass.extend({
	/* --- status flavours -------------------------------------------------
	   `status` unwraps the modems map (what the views iterate);
	   `statusRaw` returns the whole status object (modems + contexts +
	   board …) — wwand.modemopts needs .board/.modems;
	   `contexts` unwraps the contexts map (status page connection cards). */
	status:     rpc.declare({ object: 'wwand', method: 'status', expect: { modems: {} } }),
	/* the daemon's globals block — carries the level the PROCESS logs at, which
	   the configured value does not tell you once it has been overridden */
	globals:    rpc.declare({ object: 'wwand', method: 'status', expect: { globals: {} } }),
	setLogLevel: checked({ object: 'wwand', method: 'set_log_level',
	                           params: [ 'level' ], expect: {} }),
	statusRaw:  rpc.declare({ object: 'wwand', method: 'status', expect: { '': {} } }),
	contexts:   rpc.declare({ object: 'wwand', method: 'status', expect: { contexts: {} } }),

	/* --- telemetry ------------------------------------------------------- */
	signal:     rpc.declare({ object: 'wwand', method: 'modem_signal', params: [ 'modem' ], expect: {} }),
	cells:      rpc.declare({ object: 'wwand', method: 'modem_cells',  params: [ 'modem' ], expect: {} }),
	datapath:   rpc.declare({ object: 'wwand', method: 'modem_datapath', params: [ 'modem' ], expect: {} }),
	gps:        rpc.declare({ object: 'wwand', method: 'modem_gps', params: [ 'modem' ], expect: {} }),
	ctxStatus:  rpc.declare({ object: 'wwand', method: 'context_status', params: [ 'interface' ], expect: {} }),

	/* --- hardware -------------------------------------------------------- */
	probe:      rpc.declare({ object: 'wwand', method: 'modem_probe', expect: {} }),
	modemReset: checked({ object: 'wwand', method: 'modem_reset', params: [ 'modem' ], expect: {} }),
	modemRepower: checked({ object: 'wwand', method: 'modem_repower', params: [ 'modem' ], expect: {} }),
	modemReattach: checked({ object: 'wwand', method: 'modem_reattach', params: [ 'modem' ], expect: {} }),
	setProtocol: checked({ object: 'wwand', method: 'modem_set_protocol', params: [ 'modem', 'protocol' ], expect: {} }),

	/* --- carrier configuration (MBN, over QMI PDC) ------------------------
	   op = list | get | set. A `set` only takes effect after a modem reset and
	   is reported as `pending` until then, so the UI must not claim the switch
	   already happened. */
	carrierConfig: checked({ object: 'wwand', method: 'modem_carrier_config',
		params: [ 'modem', 'op', 'id' ], expect: {} }),

	/* the modem's own eUICC profile read, for cards lpac structurally cannot
	   enumerate (an M2M eUICC has no local ES10) */
	euiccProfiles: rpc.declare({ object: 'wwand', method: 'modem_euicc_profiles',
		params: [ 'modem', 'slot' ], expect: {} }),

	/* --- SIM / eSIM ------------------------------------------------------ */
	slots:      rpc.declare({ object: 'wwand', method: 'modem_sim_slots', params: [ 'modem' ], expect: {} }),
	switchSlot: checked({ object: 'wwand', method: 'modem_sim_switch_slot', params: [ 'modem', 'slot' ], expect: {} }),
	pinVerify:  checked({ object: 'wwand', method: 'modem_sim_pin_verify', params: [ 'modem', 'pin' ], expect: {} }),
	simPuk:     checked({ object: 'wwand', method: 'modem_sim_puk', params: [ 'modem', 'puk', 'new_pin' ], expect: {} }),
	pinLock:    checked({ object: 'wwand', method: 'modem_sim_pin_lock', params: [ 'modem', 'pin', 'enable' ], expect: {} }),
	/* READ-ONLY profile list. NOT `esim` with op 'profiles': that method is in
	   the WRITE acl because its other ops enable, disable and delete profiles,
	   and rpcd grants a METHOD, never a method with certain arguments — so a
	   read-only operator was denied the status page on every eUICC box. */
	esimProfiles: rpc.declare({ object: 'wwand', method: 'modem_esim_profiles',
		params: [ 'modem', 'slot' ], expect: {} }),

	esim:       checked({ object: 'wwand', method: 'modem_esim',
		params: [ 'modem', 'op', 'slot', 'iccid', 'activation_code', 'confirmation_code', 'auto_notify' ], expect: {} }),

	/* --- settings / network selection ------------------------------------ */
	getSettings: rpc.declare({ object: 'wwand', method: 'modem_get_settings', params: [ 'modem' ], expect: {} }),
	setSettings: checked({ object: 'wwand', method: 'modem_set_settings', params: [ 'modem', 'settings' ], expect: {} }),
	setNetsel:   checked({ object: 'wwand', method: 'modem_set_network_selection',
		params: [ 'modem', 'mode', 'mcc', 'mnc', 'mnc_digits' ], expect: {} }),
	plmn:        rpc.declare({ object: 'wwand', method: 'modem_plmn_lists', params: [ 'modem' ], expect: {} }),
	plmnSet:     checked({ object: 'wwand', method: 'modem_plmn_set', params: [ 'modem', 'list_type', 'entries' ], expect: {} }),
	plmnRestore: checked({ object: 'wwand', method: 'modem_plmn_restore', params: [ 'modem' ], expect: {} }),
	scan:        checked({ object: 'wwand', method: 'modem_scan', params: [ 'modem' ], expect: {} }),
	scanStart:   checked({ object: 'wwand', method: 'modem_scan_start', params: [ 'modem' ], expect: {} }),
	scanStatus:  rpc.declare({ object: 'wwand', method: 'modem_scan_status', params: [ 'modem' ], expect: {} }),

	/* --- SMS -------------------------------------------------------------- */
	smsList:   rpc.declare({ object: 'wwand', method: 'modem_sms_list', params: [ 'modem', 'storage' ], expect: {} }),
	/* `indices` deletes a set in ONE call and answers { deleted, requested,
	   failed }; `index` is the single-message form and still answers { ok }.
	   Deliberately no "delete all": the daemon has no such primitive, because it
	   would delete what is in the store when the modem runs it rather than what
	   the operator was shown. */
	smsDelete: checked({ object: 'wwand', method: 'modem_sms_delete', params: [ 'modem', 'storage', 'index', 'indices' ], expect: {} }),

	/* --- migration -------------------------------------------------------- */
	/* convert selected legacy proto qmi/mbim/ncm interfaces to proto wwand
	   in place. apply=false returns the planned changes (preview). */
	migrate: checked({ object: 'wwand', method: 'migrate', params: [ 'apply', 'interfaces' ], expect: {} }),

	/* All *named* GPIO lines (from the DT gpio-line-names), for the
	   reset/power GPIO picker. Skips the export/unexport control files and
	   the raw gpiochipN/gpioNNN entries. */
	gpioList: rpc.declare({
		object: 'file', method: 'list', params: [ 'path' ], expect: { entries: [] },
		filter: function(list) {
			var rv = [];
			for (var i = 0; i < list.length; i++) {
				var n = list[i].name;
				if (n && n != 'export' && n != 'unexport' && !/^gpio(chip)?[0-9]+$/.test(n))
					rv.push(n);
			}
			return rv.sort();
		}
	})
});
