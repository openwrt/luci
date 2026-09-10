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

return baseclass.extend({
	/* --- status flavours -------------------------------------------------
	   `status` unwraps the modems map (what the views iterate);
	   `statusRaw` returns the whole status object (modems + contexts +
	   board …) — wwand.modemopts needs .board/.modems;
	   `contexts` unwraps the contexts map (status page connection cards). */
	status:     rpc.declare({ object: 'wwand', method: 'status', expect: { modems: {} } }),
	statusRaw:  rpc.declare({ object: 'wwand', method: 'status', expect: { '': {} } }),
	contexts:   rpc.declare({ object: 'wwand', method: 'status', expect: { contexts: {} } }),

	/* --- telemetry ------------------------------------------------------- */
	signal:     rpc.declare({ object: 'wwand', method: 'modem_signal', params: [ 'modem' ], expect: {} }),
	cells:      rpc.declare({ object: 'wwand', method: 'modem_cells',  params: [ 'modem' ], expect: {} }),
	datapath:   rpc.declare({ object: 'wwand', method: 'modem_datapath', params: [ 'modem' ], expect: {} }),
	ctxStatus:  rpc.declare({ object: 'wwand', method: 'context_status', params: [ 'interface' ], expect: {} }),

	/* --- hardware -------------------------------------------------------- */
	probe:      rpc.declare({ object: 'wwand', method: 'modem_probe', expect: {} }),
	modemReset: rpc.declare({ object: 'wwand', method: 'modem_reset', params: [ 'modem' ], expect: {} }),
	modemRepower: rpc.declare({ object: 'wwand', method: 'modem_repower', params: [ 'modem' ], expect: {} }),
	modemReattach: rpc.declare({ object: 'wwand', method: 'modem_reattach', params: [ 'modem' ], expect: {} }),
	setProtocol: rpc.declare({ object: 'wwand', method: 'modem_set_protocol', params: [ 'modem', 'protocol' ], expect: {} }),

	/* --- carrier configuration (MBN, over QMI PDC) ------------------------
	   op = list | get | set. A `set` only takes effect after a modem reset and
	   is reported as `pending` until then, so the UI must not claim the switch
	   already happened. */
	carrierConfig: rpc.declare({ object: 'wwand', method: 'modem_carrier_config',
		params: [ 'modem', 'op', 'id' ], expect: {} }),

	/* the modem's own eUICC profile read, for cards lpac structurally cannot
	   enumerate (an M2M eUICC has no local ES10) */
	euiccProfiles: rpc.declare({ object: 'wwand', method: 'modem_euicc_profiles',
		params: [ 'modem', 'slot' ], expect: {} }),

	/* --- SIM / eSIM ------------------------------------------------------ */
	slots:      rpc.declare({ object: 'wwand', method: 'modem_sim_slots', params: [ 'modem' ], expect: {} }),
	switchSlot: rpc.declare({ object: 'wwand', method: 'modem_sim_switch_slot', params: [ 'modem', 'slot' ], expect: {} }),
	pinVerify:  rpc.declare({ object: 'wwand', method: 'modem_sim_pin_verify', params: [ 'modem', 'pin' ], expect: {} }),
	simPuk:     rpc.declare({ object: 'wwand', method: 'modem_sim_puk', params: [ 'modem', 'puk', 'new_pin' ], expect: {} }),
	pinLock:    rpc.declare({ object: 'wwand', method: 'modem_sim_pin_lock', params: [ 'modem', 'pin', 'enable' ], expect: {} }),
	esim:       rpc.declare({ object: 'wwand', method: 'modem_esim',
		params: [ 'modem', 'op', 'slot', 'iccid', 'activation_code', 'confirmation_code', 'auto_notify' ], expect: {} }),

	/* --- settings / network selection ------------------------------------ */
	getSettings: rpc.declare({ object: 'wwand', method: 'modem_get_settings', params: [ 'modem' ], expect: {} }),
	setSettings: rpc.declare({ object: 'wwand', method: 'modem_set_settings', params: [ 'modem', 'settings' ], expect: {} }),
	setNetsel:   rpc.declare({ object: 'wwand', method: 'modem_set_network_selection',
		params: [ 'modem', 'mode', 'mcc', 'mnc' ], expect: {} }),
	plmn:        rpc.declare({ object: 'wwand', method: 'modem_plmn_lists', params: [ 'modem' ], expect: {} }),
	plmnSet:     rpc.declare({ object: 'wwand', method: 'modem_plmn_set', params: [ 'modem', 'list_type', 'entries' ], expect: {} }),
	plmnRestore: rpc.declare({ object: 'wwand', method: 'modem_plmn_restore', params: [ 'modem' ], expect: {} }),
	scan:        rpc.declare({ object: 'wwand', method: 'modem_scan', params: [ 'modem' ], expect: {} }),
	scanStart:   rpc.declare({ object: 'wwand', method: 'modem_scan_start', params: [ 'modem' ], expect: {} }),
	scanStatus:  rpc.declare({ object: 'wwand', method: 'modem_scan_status', params: [ 'modem' ], expect: {} }),

	/* --- SMS -------------------------------------------------------------- */
	smsList:   rpc.declare({ object: 'wwand', method: 'modem_sms_list', params: [ 'modem', 'storage' ], expect: {} }),
	smsDelete: rpc.declare({ object: 'wwand', method: 'modem_sms_delete', params: [ 'modem', 'storage', 'index' ], expect: {} }),

	/* --- migration -------------------------------------------------------- */
	/* convert selected legacy proto qmi/mbim/ncm interfaces to proto wwand
	   in place. apply=false returns the planned changes (preview). */
	migrate: rpc.declare({ object: 'wwand', method: 'migrate', params: [ 'apply', 'interfaces' ], expect: {} }),

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
