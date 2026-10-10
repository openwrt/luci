/*
 * Copyright (C) 2008-2026 The OpenWrt Project
 * Copyright (C) 2026 Manfred Jaider <info@masmbit.com>
 *
 * This is free software, licensed under the Apache License, Version 2.0.
 * See /LICENSE for more information.
 *
 * luci-app-openvpn-plus : key editor and generator for easy certificate management
 * /www/luci-static/resources/view/vpn/openvpn-keygen.js
 *
 * 1. --- TEXT & DEFINITIONS --- ....Global translations and system definitions
 * 2. --- KEY EDITOR --- ........... Text area editor for key files
 * 3. --- KEY GENERATOR --- ........ Background key generation wizard
 */

/* global E, URL, Blob, */
'use strict';
'require uqr';
'require network';

/*
 * --- TEXT & DEFINITIONS ---
 */
const TXT = {
	INFO: {
		default: _('Default'),
		file_location: _('File Location: '),
		type: _('Type'),
		valid_until: _('Valid Until'),
		years: _('Years'),
		wizard: _('Wizard'),
		server: _('Server'),
		client: _('Client')
	},
	BTN: {
		close: _('Close'),
		cancel: _('Cancel'),
		download: _('Download'),
		enable_save: _('Enable Save'),
		generate: _('Generate'),
		save_apply: _('Save & Apply'),
		save_config: _('Save Config'),
		saving: _('Saving...'),
		saved: _('Saved'),
	},
	KEY: {
		certificate: _('Certificate'),
		client_ca_private_key_issued_by_ca: _('Client Certificate + Private key (issued by CA) + TLS Crypt v2 Client key'),
		client_key_generated: _('Client keys generated successfully!'),
		client_keys_exported: _('Client keys exported successfully.'),
		clone_default_keys: _('No (Clone Default Keys)'),
		common_name: _('Common Name (CN)'),
		custom_cli: _('Custom CLI Options'),
		dh_description: _('Diffie-Hellman parameters enforce numeric prime bit boundaries exclusively.'),
		export_keys: _('Export Keys'),
		generate_tls_key: _('Generating TLS-Crypt key...'),
		generate_unique_keys: _('Yes (Generate Unique Keys)'),
		generate_unique_keys_new_instance: _('To be secure, a new instance needs its own key files. Do you want to create them now? (Recommended - usually takes just a few moments)'),
		generating_client_keys: _('Generating private client key...'),
		key_strength: _('Key Strength'),
		loading_contents: _('Loading key contents...'),
		master_ca: _('Master CA'),
		not_applicable: _('Not applicable'),
		opt_dh: _('Diffie-Hellman Parameters (Perfect Forward Secrecy)'),
		opt_full_pki: _('Full PKI Suite (CA + Server Certificate + Private Server Key)'),
		opt_tls_server: _('TLS Crypt v2 Server Master Key (Anti-DoS / Port-Scan Protection)'),
		opt_tls_client: _('TLS Crypt v2 Client Key (Anti-DoS / Port-Scan Protection)'),
		placeholder_cn: _("e.g. Remote Office 1"),
		placeholder_dh: _('e.g. -text (shows hex output)'),
		placeholder_pki: _('e.g. -sha256 ; -noout ; -sha256'),
		placeholder_pki_client: _('e.g. -traditional ; ; -sha256'),
		placeholder_tls: _('N/A - openvpn --genkey accepts no extra flags'),
		pki_saved: _('PKI Suite components saved successfully.'),
		pki_step1: _('Step 1/3: Generating Certificate Authority (CA)...'),
		pki_step2: _('Step 2/3: Generating Private Server Key...'),
		pki_step3: _('Step 3/3: Generating & Signing Server Certificate...'),
		private_key: _('Private Key'),
		progress: _('Progress & Output'),
		pure_ecc: _('Pure ECC'),
		pure_rsa: _('Pure RSA'),
		ready: _('Ready for key generation.'),
		running: _('Crypto operation running. Please wait...'),
		secret_ca: _('Secret CA Key'),
		signing_client_using_server_ca: _('Signing client certificate using server CA...'),
		strength_description: _('Recommended: RSA-2048 + ECC-Prime256v1. RSA ensures CA compatibility, while ECC accelerates the data tunnel.'),
		tls_description_server: _('The main TLS security key on the server. It encrypts the connection and creates the keys for all clients.'),
		tls_description_client: _('A unique TLS security key for one client. It encrypts and protects all data sent to the server.'),
		tls_key_saved: _('TLS-Crypt key saved successfully.'),
		tls_key_server: _('Master Server Secret Key'),
		tls_key_client: _('Client Key'),
		title_main: _('OpenVPN Instance Key Generator'),
		key_allocation: ('Key Allocation'),
		unknown_asset: _('Unknown Asset'),
		use_unique_name_for_each_office: _('Important: Use a unique name for each office to configure the network routing correctly.'),
		validity_days: _('Validity (Days)'),
		vpn_key_type: _('VPN Key Type:')
	},
	WARNING: {
		clicking_save_will_break_vpn: _('WARNING: Clicking save will instantly break all active VPN tunnels. You must generate and share new client profiles (.ovpn) to restore the connections.'),
		key_not_saved: _('Generated keys are not saved! Close window and discard keys?'),
		key_decrepted: _('Deprecated TLS-Crypt V1 key (Not supported)'),
		use_wizard_hint_title: _('Deployment Recommendation:'),
		use_wizard_hint_desc: _('It is highly recommended to use the automated Setup Wizard to deploy a Mobile Server (OpenVPN Connect) or a Headquarters LAN-to-LAN Server. In just a few clicks, the wizard fully configures easy DDNS provider setup, multi-client remote networks, optimal firewall zones, and scan-ready QR codes.')
	},
	ERROR: {
		format_corruption: _('The saved key data contains structural format corruption!'),
		polling_threshold: _('ERROR: Safety polling threshold exceeded boundaries. Process deadlocked.'),
	}
}

const CFG = Object.freeze({
	FILE: Object.freeze({
		dir_keys: '/etc/openvpn/keys/',
		openvpn_keygen_log: '/tmp/openvpn.keygen.log',
		temp_openvpn_keygen: '/tmp/openvpn.keygen.',
	}),
	LIBEXEC: Object.freeze({
		keygen: 'keygen',
		keymeta: 'keymeta',
		keygenclean: 'keygenclean'
	}),
	ID: Object.freeze({
		central_keygen_mode: 'central_keygen_mode',
		keygen_bits_desc: 'keygen_bits_desc',
		keygen_bits_dh: 'keygen_bits_dh',
		keygen_bits_pki: 'keygen_bits_pki',
		keygen_years: 'keygen_years',
		row_keygen_years: 'row_keygen_years',
		keygen_cn: 'keygen_cn',
		row_keygen_cn: 'row_keygen_cn',
	})
})

const ICON = Object.freeze({
	ARROW: '➔ ',
	ERROR: '❌ ',
	LAPTOP: '💻 ',
	ROCKET: '🚀 ',
	SAVE: '💾 ',
	SUCCESS: '✅ ',
	WARNING: '⚠️ ',
	EXPORT: '📤 ',
});

const OPENVPN = Object.freeze({
	ROLE: Object.freeze({
		SERVER: 'server',
	}),
});

const KEYTYPE = Object.freeze({
	ca: 'ca',
	dh: 'dh',
	pki: 'pki',
	client_pki: 'client_pki',
	server_key: 'server-key',
	client_key: 'client-key',
	server_cert: 'server-cert',
	client_cert: 'client-cert',
	server_tls2: 'server-tls2',
	client_tls2: 'client-tls2',

	rsa2048_ec: 'rsa2048_ec',
	rsa4096_ec: 'rsa4096_ec',
	ec: 'ec',
	b2048: '2048',
	b4096: '4096',
	y100: "100",
});

/**
 * Strips all accidental Windows or Mac line breaks and trims spaces.
 */
const sanitizeInputLine = function (value) {
	return String(value || '').trim().replace(/[\r\n]/g, '');
};

/**
 * Normalizes all Windows and Mac line breaks into clean UNIX line breaks for textareas.
 */
const sanitizeInputText = function (value) {
	const rawText = value ? String(value).trim() : '';
	return rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};


/**
 * --- KEY EDITOR ---
 */


/**
 * Show simple key editor that verifies and displays key metadata.
 */
const openKeyEditorModal = function (filename, instance_id, displayId, role, appData, uciSaveApplyRestartCallback, rpcFileCallbacks) {
	const absolutePath = CFG.FILE.dir_keys + filename;
	let hasSaved = false;

	const modalKeyTextArea = E('textarea', {
		'class': 'cbi-input-textarea',
		'style': 'width:100%; max-width:100%; resize:vertical; font-family:var(--font-monospace, monospace); font-size:12px; background:#18181b; color:#4ade80; padding:15px; border-radius:4px; border:1px solid var(--border-color-medium, #cbd5e1); text-shadow:none;',
		'rows': '18',
		'wrap': 'off'
	}, [TXT.KEY.loading_contents]);

	const quickInfoBox = E('div', {
		'style': 'margin-bottom:12px; padding:10px 15px; border-left:4px solid var(--primary-color-high, #1976d2); background:color-mix(in srgb, var(--primary-color-high, #1976d2) 10%, transparent); border-radius:4px; font-size:12px; line-height:1.6; color:var(--text-color-high, #3f3f46); display:none;'
	});

	// Update the quick info box content
	const quickInfoBoxUpdate = function (rawMeta) {
		let keyTypeInfo = TXT.KEY.unknown_asset;
		let expirationInfo = TXT.KEY.not_applicable;
		let commonNameInfo = '';
		let isInvalid = false;
		const cleanMeta = String(rawMeta || '').trim();

		// Parse expiration date safely
		const expiryMatch = cleanMeta.match(/Not After\s*:\s*([^\n\r]+)/i);
		if (expiryMatch && expiryMatch[1]) {
			expirationInfo = expiryMatch[1].trim();
		}

		// Extract Subject Common Name perfectly supporting optional spaces
		const cnMatch = cleanMeta.match(/Subject\s*:\s*CN\s*=\s*([^,\n\r]+)/i);
		if (cnMatch && cnMatch[1]) {
			commonNameInfo = cnMatch[1].trim();
		}

		// Identify key type and strength using clean text patterns
		if ((cleanMeta.indexOf('Public-Key: (4096 bit)') !== -1) || (cleanMeta.indexOf('Private-Key: (4096 bit)') !== -1)) {
			keyTypeInfo = 'RSA 4096 Bit';
		} else if (cleanMeta.indexOf('Public-Key: (256 bit)') !== -1 || cleanMeta.indexOf('prime256v1') !== -1) {
			keyTypeInfo = 'ECC Prime256v1';
		} else if ((cleanMeta.indexOf('Public-Key: (2048 bit)') !== -1) || (cleanMeta.indexOf('Private-Key: (2048 bit)') !== -1 || cleanMeta.indexOf('PRIVATE-KEY') !== -1)) {
			keyTypeInfo = 'RSA 2048 Bit';
		} else if (cleanMeta.indexOf('DH PARAMETERS') !== -1 || cleanMeta.indexOf('bit') !== -1) {
			const dhBits = cleanMeta ? cleanMeta.match(/([0-9]+)\s*bit/i) : null;
			const dbits_info = dhBits ? '(' + dhBits[1] + ' Bit)' : '';
			keyTypeInfo = 'Diffie-Hellman ' + dbits_info;
		} else if (cleanMeta.indexOf('TLSv2-Server-Key') !== -1) {
			keyTypeInfo = 'TLS Crypt v2';
		} else if (cleanMeta.indexOf('TLSv2-Client-Key') !== -1) {
			keyTypeInfo = 'TLS Crypt v2';
		} else if (cleanMeta.indexOf('Unsupported') !== -1) {
			keyTypeInfo = '<span style="color:var(--success-color-high, #00ac59); font-weight:bold;">' + ICON.WARNING + TXT.WARNING.key_decrepted + '</span>';
			isInvalid = true;
		} else if (cleanMeta.indexOf('ERROR') !== -1) {
			keyTypeInfo = '<span style="color:var(--success-color-high, #00ac59); font-weight:bold;">' + ICON.ERROR + TXT.ERROR.format_corruption + '</span>';
			isInvalid = true;
		}

		// Role identities to make the type text easy to read for the admin
		if (!isInvalid) {
			const strRole = (role === OPENVPN.ROLE.SERVER) ? TXT.INFO.server : TXT.INFO.client;

			if (cleanMeta.indexOf('AUTHORITY') !== -1 || cleanMeta.indexOf('CA:TRUE') !== -1) {
				if (cleanMeta.indexOf('SECRET-KEY-CA') !== -1) {
					keyTypeInfo += ' - <span style="color:var(--success-color-high, #00ac59); font-weight:bold;">[' + TXT.KEY.master_ca + ' ' + TXT.KEY.certificate + ' ' + TXT.KEY.secret_ca + ']</span>';
				} else {
					keyTypeInfo += ' - <span style="color:var(--success-color-high, #00ac59); font-weight:bold;">[' + TXT.KEY.master_ca + ' ' + TXT.KEY.certificate + ']</span>';
				}
			} else if (cleanMeta.indexOf('STANDARD CERTIFICATE') !== -1) {
				keyTypeInfo += ' - <span style="color:var(--primary-color-high, #1976d2); font-weight:bold;">[' + strRole + ' ' + TXT.KEY.certificate + ']</span>';
			} else if (cleanMeta.indexOf('Private-Key') !== -1 || cleanMeta.indexOf('PRIVATE-KEY') !== -1) {
				keyTypeInfo += ' - <span style="color:var(--success-color-high, #00ac59); font-weight:bold;">[' + strRole + ' ' + TXT.KEY.private_key + ']</span>';
			} else if (cleanMeta.indexOf('TLSv2-Server-Key') !== -1) {
				keyTypeInfo += ' - <span style="color:var(--success-color-high, #00ac59); font-weight:bold;">[' + TXT.KEY.tls_key_server + ']</span>';
			} else if (cleanMeta.indexOf('TLSv2-Client-Key') !== -1) {
				keyTypeInfo += ' - <span style="color:var(--success-color-high, #00ac59); font-weight:bold;">[' + TXT.KEY.tls_key_client + ']</span>';
			}
		}

		// Apply styles and render HTML nodes dynamically
		if (isInvalid) {
			quickInfoBox.style.borderLeftColor = 'var(--success-color-high, #00ac59)';
			quickInfoBox.innerHTML = keyTypeInfo;
		} else {
			quickInfoBox.style.borderLeftColor = 'var(--primary-color-high, #1976d2)';
			let innerHtmlMarkup = '<div><strong>' + TXT.INFO.type + ':</strong> ' + keyTypeInfo + '</div>';

			if (commonNameInfo) {
				innerHtmlMarkup += '<div style="margin-top:4px;"><strong>' + TXT.KEY.common_name + ': </strong><span style="font-family:var(--font-monospace, monospace); font-weight:bold; color:var(--primary-color-high, #1976d2);">' + commonNameInfo + '</span></div>';
			}
			innerHtmlMarkup += '<div style="margin-top:4px;"><strong>' + TXT.INFO.valid_until + ':</strong> ' + expirationInfo + '</div>';
			quickInfoBox.innerHTML = innerHtmlMarkup;
		}
		quickInfoBox.style.display = 'block';
	};

	// Read file and parse metadata
	rpcFileCallbacks.rpcReadFile(absolutePath).then(function (content) {
		modalKeyTextArea.value = content ? content.trim() + '\n' : '--- EMPTY OR BLANK KEY FILE ---';

		if (!content || content.trim() === '') return;

		rpcFileCallbacks.luci_app_openvpn_plus([CFG.LIBEXEC.keymeta, filename]).then(function (res) {
			if (res.length > 0) {
				quickInfoBoxUpdate(res);
			}
		});
	});

	const modalSaveApplyBtn = E('button', {
		'class': 'cbi-button cbi-button-save',
		'style': 'margin-right:10px;'
	}, [TXT.BTN.save_apply]);

	modalSaveApplyBtn.addEventListener('click', function () {
		modalSaveApplyBtn.disabled = true;
		modalSaveApplyBtn.textContent = TXT.BTN.saving;

		// Standardize all copy-pasted line endings instantly (Supports UNIX \n, Windows \r\n, and Mac \r)
		const sanitizedKeyContent = sanitizeInputText(modalKeyTextArea.value) + '\n';

		// Write file and re-validate key metadata (Using our clean sanitized text string)
		rpcFileCallbacks.rpcWriteFile(absolutePath, sanitizedKeyContent)
			.then(function () {
				return rpcFileCallbacks.luci_app_openvpn_plus([CFG.LIBEXEC.keymeta, filename]);
			})
			.then(function (keymeta) {

				if (keymeta.indexOf('ERROR') !== -1) {
					quickInfoBoxUpdate(keymeta);
					modalSaveApplyBtn.disabled = false;
					modalSaveApplyBtn.textContent = TXT.BTN.save_apply;
					return Promise.reject(new Error('Editor validation failed'));
				}

				hasSaved = true;
				modalSaveApplyBtn.textContent = TXT.BTN.saved;

				setTimeout(function () {
					modalSaveApplyBtn.disabled = false;
					modalSaveApplyBtn.textContent = TXT.BTN.save_apply;
					if (keymeta !== '') {
						quickInfoBoxUpdate(keymeta);
					}
				}, 1200);
			})
			.catch(function (err) {
				if (err.message !== 'Editor validation failed') {
					console.error('Editor save chain caught unhandled error context:', err);
					modalSaveApplyBtn.disabled = false;
					modalSaveApplyBtn.textContent = TXT.BTN.save_apply;
				}
			});
	});

	const modalDownloadKeyBtn = E('button', {
		'class': 'cbi-button cbi-button-apply',
		'style': 'margin-right:10px;'
	}, [TXT.BTN.download]);

	modalDownloadKeyBtn.addEventListener('click', function () {
		const blob = new Blob([modalKeyTextArea.value], { type: 'text/plain' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	});

	const modalCloseEditBtn = E('button', {
		'class': 'cbi-button cbi-button-neutral'
	}, [TXT.BTN.close]);

	modalCloseEditBtn.addEventListener('click', function () {
		L.ui.hideModal();
		if (hasSaved) {
			uciSaveApplyRestartCallback(instance_id);
		}
	});

	L.ui.showModal(displayId + ' - ' + filename, [
		E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr', 'style': 'margin-bottom:12px; font-style:italic; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);' }, [TXT.INFO.file_location + absolutePath]),
				quickInfoBox,
				E('div', { 'style': 'margin-bottom:20px;' }, [modalKeyTextArea]),
				E('div', { 'style': 'text-align:right;' }, [modalSaveApplyBtn, modalDownloadKeyBtn, modalCloseEditBtn])
			])
		])
	]);
};


/**
 * --- KEY GENERATOR ---
 */


/**
 * Creates keys and certificates using background background scripts
 */
const executeAsynchronousKeyGen = function (instance_id, active_mode, rawBitsSelection, selectedYears, targetCnName, customCliString, statusOutputNode, rpcFileCallbacks, finalCallback, displayMode) {
	if (!statusOutputNode) {
		return;
	}
	if (!(active_mode === KEYTYPE.pki || active_mode === KEYTYPE.client_pki ||
		active_mode === KEYTYPE.ca || active_mode === KEYTYPE.server_key || active_mode === KEYTYPE.server_cert || active_mode === KEYTYPE.client_key || active_mode === KEYTYPE.client_cert ||
		active_mode === KEYTYPE.dh || active_mode === KEYTYPE.server_tls2 || active_mode === KEYTYPE.client_tls2)) {
		return;
	}

	const keygenCleanUp = function () { rpcFileCallbacks.luci_app_openvpn_plus([CFG.LIBEXEC.keygenclean]); };

	const days = (parseInt(selectedYears, 10) * 365).toString();

	const rawCustom = customCliString ? customCliString.trim() : '';
	const customArgsArray = rawCustom ? rawCustom.split(';') : [];
	const hasMultiStageArgs = (customArgsArray.length >= 2);

	// Safe index mapping with strict empty-string fallback protection
	const step1Custom = hasMultiStageArgs ? (customArgsArray[0] ? customArgsArray[0].trim() : '') : rawCustom;
	const step2Custom = hasMultiStageArgs ? (customArgsArray[1] ? customArgsArray[1].trim() : '') : '';
	const step3Custom = hasMultiStageArgs ? (customArgsArray[2] ? customArgsArray[2].trim() : '') : '';

	// Check the display mode to clear or keep the old text field contents
	const isAppend = (displayMode === 'append');
	let accumulatedPkiLog = isAppend ? statusOutputNode.value : '';
	const pki_payload = { ca: '', key: '', cert: '' };
	let caBits = KEYTYPE.b2048;
	let bits = KEYTYPE.b2048;
	let pollCount = 0;

	let currentPkiStep = 0;
	let backendType = active_mode;
	if (active_mode === KEYTYPE.pki) {
		// on pki start with ca
		backendType = KEYTYPE.ca;
		currentPkiStep = 1;
	} else if (active_mode === KEYTYPE.client_pki) {
		// set the initial backend execution type trigger command for the client key pair
		backendType = KEYTYPE.client_key;
		// client_pki will skip step 1 (CA) since it derives assets directly from the server's existing CA
		currentPkiStep = 2;
	}

	// Choose the correct key strength and bits selection parameters
	if (active_mode === KEYTYPE.pki || active_mode === KEYTYPE.client_pki) {
		if (rawBitsSelection === KEYTYPE.rsa2048_ec) {
			caBits = KEYTYPE.b2048;
			bits = KEYTYPE.ec;
		} else if (rawBitsSelection === KEYTYPE.rsa4096_ec) {
			caBits = KEYTYPE.b4096;
			bits = KEYTYPE.ec;
		} else if (rawBitsSelection === KEYTYPE.ec) {
			caBits = KEYTYPE.ec;
			bits = KEYTYPE.ec;
		} else {
			caBits = rawBitsSelection;
			bits = rawBitsSelection;
		}
	} else {
		caBits = rawBitsSelection;
		bits = rawBitsSelection;
	}

	if (isAppend) {
		statusOutputNode.value += TXT.KEY.running + '\n';
	} else {
		statusOutputNode.value = TXT.KEY.running + '\n';
	}

	// Run the system command to start the key background script
	rpcFileCallbacks.luci_app_openvpn_plus([CFG.LIBEXEC.keygen, backendType, instance_id, caBits, days, targetCnName, step1Custom]);

	if (active_mode === KEYTYPE.pki) {
		accumulatedPkiLog = ICON.ARROW + TXT.KEY.pki_step1 + '\n';
		statusOutputNode.value = accumulatedPkiLog;
	} else if (active_mode === KEYTYPE.client_pki) {
		// Set initial status logging output text message for the client workflow track
		accumulatedPkiLog = ICON.ARROW + TXT.KEY.generating_client_keys + '\n';
		statusOutputNode.value = accumulatedPkiLog;
	} else {
		if (isAppend) {
			accumulatedPkiLog = statusOutputNode.value + ICON.ARROW + TXT.KEY.running + '\n';
		} else {
			accumulatedPkiLog = ICON.ARROW + TXT.KEY.running + '\n';
		}
		statusOutputNode.value = accumulatedPkiLog;
	}

	// Start a timer loop to read the progress log file every 200 milliseconds
	const logPollerInterval = setInterval(function () {
		pollCount++;

		rpcFileCallbacks.rpcReadFile(CFG.FILE.openvpn_keygen_log).then(function (logContent) {
			if (logContent && logContent.trim() !== '') {
				const beautifiedLog = logContent.replace(/\[CMD\]/g, ICON.LAPTOP);
				statusOutputNode.value = accumulatedPkiLog + beautifiedLog;
				statusOutputNode.scrollTop = statusOutputNode.scrollHeight;

				// Check if the log file says that the current step was successful
				if (logContent.lastIndexOf('LOG: WORKFLOW_SUCCESSFUL') !== -1) {

					// Map target key file name dynamically
					let targetTmpFile = CFG.FILE.temp_openvpn_keygen + backendType + '.tmp';

					// Read the temporary file containing the generated text data
					rpcFileCallbacks.rpcReadFile(targetTmpFile).then(function (finalAsset) {

						if (!finalAsset || finalAsset.trim() === '') {
							return;
						}
						const finalBeautifiedLog = beautifiedLog.replace('LOG: WORKFLOW_SUCCESSFUL', '').trim();
						const log_separator_line = '\n\n--------------------------------------------------\n\n';

						// Symmetrically route multi-stage full PKI certificate generation loops
						if (active_mode === KEYTYPE.pki || active_mode === KEYTYPE.client_pki) {
							if (currentPkiStep === 1) {
								pki_payload.ca = finalAsset;
								currentPkiStep = 2;
								backendType = KEYTYPE.server_key;
								accumulatedPkiLog += finalBeautifiedLog + log_separator_line + ICON.ARROW + TXT.KEY.pki_step2 + '\n';

								rpcFileCallbacks.luci_app_openvpn_plus([CFG.LIBEXEC.keygen, backendType, instance_id, bits, days, targetCnName, step2Custom]);

							} else if (currentPkiStep === 2) {
								pki_payload.key = finalAsset;
								currentPkiStep = 3;
								backendType = (active_mode === KEYTYPE.client_pki) ? KEYTYPE.client_cert : KEYTYPE.server_cert;

								const displayStepText = (active_mode === KEYTYPE.client_pki) ? TXT.KEY.signing_client_using_server_ca : TXT.KEY.pki_step3;
								accumulatedPkiLog += finalBeautifiedLog + log_separator_line + ICON.ARROW + displayStepText + '\n';

								rpcFileCallbacks.luci_app_openvpn_plus([CFG.LIBEXEC.keygen, backendType, instance_id, bits, days, targetCnName, step3Custom]);

							} else if (currentPkiStep === 3) {
								pki_payload.cert = finalAsset;
								clearInterval(logPollerInterval);

								// Check if we need to read the CA file (only for client_pki mode)
								var caPromise;

								if (active_mode === KEYTYPE.client_pki) {
									// Read the file and use empty string if it fails
									caPromise = rpcFileCallbacks.rpcReadFile(CFG.FILE.dir_keys + 'ca_' + instance_id + '.crt');
								} else {
									// Do not read the file, just send an empty string immediately
									caPromise = Promise.resolve('');
								}

								// This part always runs, no matter what mode we are in
								caPromise.then(function (liveCaContent) {

									// Only save the CA content if we are in client_pki mode
									if (active_mode === KEYTYPE.client_pki) {
										pki_payload.ca = String(liveCaContent || '').trim();
									}

									// Update the text area on the screen with the results
									statusOutputNode.value = accumulatedPkiLog + finalBeautifiedLog + '\n\n' +
										ICON.SUCCESS + ' ' + TXT.KEY.client_key_generated + '\n\n' +
										'--- ca.crt ---\n' + pki_payload.ca + '\n\n' +
										'--- client.key ---\n' + pki_payload.key + '\n\n' +
										'--- client.crt ---\n' + pki_payload.cert + '\n';

									// Scroll to the bottom of the text area automatically
									statusOutputNode.scrollTop = statusOutputNode.scrollHeight;

									// Call the final callback function if it exists
									if (typeof finalCallback === 'function') {
										finalCallback(true, pki_payload, null);
										keygenCleanUp();
									}
								});
							}
						} else {
							// For DH or TLS modes stop the timer and send back the results
							clearInterval(logPollerInterval);

							statusOutputNode.value = accumulatedPkiLog + finalBeautifiedLog + log_separator_line + finalAsset;
							statusOutputNode.scrollTop = statusOutputNode.scrollHeight;

							if (typeof finalCallback === 'function') {
								finalCallback(true, null, finalAsset);
								keygenCleanUp();
							}
						}
					});
				}

				// Stop the timer loop if the background script logs an error
				if (logContent.indexOf('ERROR:') !== -1) {
					clearInterval(logPollerInterval);
					if (typeof finalCallback === 'function') {
						finalCallback(false, null, null);
						keygenCleanUp();
					}
				}
			}

			// Force stop the timer if the process takes too long
			if (pollCount > 3000) {
				clearInterval(logPollerInterval);
				statusOutputNode.value += '\n' + TXT.ERROR.polling_threshold;
				if (typeof finalCallback === 'function') {
					finalCallback(false, null, null);
					keygenCleanUp();
				}
			}
		}).catch(function () {
			// Ignore folder lag and keep running the loop
		});
	}, 200);
};

/**
 * Commits raw cryptographic key components or single key assets sequentially to disk storage.
 */
const saveKeysToDisk = function (instance_id, active_mode, pkiPayload, singlePayload, rpcFileCallbacks) {
	if (active_mode === KEYTYPE.pki) {
		if (!pkiPayload || !pkiPayload.ca || !pkiPayload.key || !pkiPayload.cert) {
			return Promise.reject(new Error('Incomplete multi-stage PKI suite payload buffer contents.'));
		}

		// Write PKI certificates and keys sequentially to disk
		return rpcFileCallbacks.rpcWriteFile(CFG.FILE.dir_keys + 'ca_' + instance_id + '.crt', pkiPayload.ca.trim() + '\n')
			.then(function () {
				return rpcFileCallbacks.rpcWriteFile(CFG.FILE.dir_keys + 'server_' + instance_id + '.key', pkiPayload.key.trim() + '\n');
			})
			.then(function () {
				return rpcFileCallbacks.rpcWriteFile(CFG.FILE.dir_keys + 'server_' + instance_id + '.crt', pkiPayload.cert.trim() + '\n');
			});
	} else {
		if (!singlePayload) {
			return Promise.reject(new Error('Empty single-asset cryptographic asset payload buffer.'));
		}

		// Write standalone DH or TLS assets to disk
		let targetFile;
		if (active_mode === KEYTYPE.dh) {
			targetFile = 'dh_' + instance_id + '.pem';
		} else if (active_mode === KEYTYPE.server_tls2) {
			targetFile = 'server_' + instance_id + '.tls2.key';
		} else if (active_mode === KEYTYPE.client_tls2) {
			targetFile = 'client_' + instance_id + '.tls2.key';
		}
		if (targetFile) {
			return rpcFileCallbacks.rpcWriteFile(CFG.FILE.dir_keys + targetFile, singlePayload.trim() + '\n');
		} else {
			return Promise.reject(new Error('Unknown keytype.'));
		}
	}
};

/**
 * Opens a window to ask the user if they want to create new unique keys
 */
const openAutomatedPostKeyGenModal = async function (newInstanceItem, appData, wizardParams, callbacks, optionalShowBtnCancel) {
	const instance_id = newInstanceItem.id;
	const cnName = wizardParams ? appData.wizardClass.getValidCommonName(wizardParams.displayName) : '';

	const progressTextArea = E('textarea', {
		'class': 'cbi-input-textarea',
		'style': 'width:100%; max-width:100%; resize:none; font-family:var(--font-monospace, monospace); font-size:12px; background:#18181b; color:#4ade80 !important; padding:15px; border-radius:4px; border:1px solid var(--border-color-medium, #cbd5e1); text-shadow:none !important; display:none;',
		'rows': '14',
		'readonly': 'readonly'
	}, TXT.KEY.ready);

	const promptMessageNode = E('p', { 'style': 'margin-bottom:15px; font-size:13px; line-height:1.5; color:var(--text-color-medium, #71717a);' },
		TXT.KEY.generate_unique_keys_new_instance
	);

	let styleHide = '';
	if (optionalShowBtnCancel !== true) {
		styleHide = ' display:none !important;';
	}

	const yesBtn = E('button', { 'class': 'btn cbi-button cbi-button-action important', 'style': 'margin-right:10px;' }, TXT.KEY.generate_unique_keys);
	const noBtn = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'style': 'margin-right:10px;' }, TXT.KEY.clone_default_keys);
	const cancelBtn = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'style': 'margin-right:10px;' + styleHide }, TXT.BTN.cancel);
	const closeBtn = E('button', { 'class': 'cbi-button cbi-button-action important', 'style': 'display:none;' }, TXT.BTN.close);

	const buttonContainer = E('div', { 'style': 'text-align:right; margin-top:15px;' }, [yesBtn, noBtn, cancelBtn, closeBtn]);

	const dashedDivider = E('hr', {
		'style': 'margin:20px 0; border:0; border-top:1px dashed var(--border-color-medium, #cbd5e1);' + styleHide
	});

	const wizardAdvertNoticeBox = E('div', {
		'class': 'alert-message',
		'style': 'margin-bottom:15px; padding:0px; font-size:12px; line-height:1.5; text-align:left; background:none !important; box-shadow:none !important; border:none !important;' + styleHide
	}, [
		E('strong', { 'style': 'display:block; margin-bottom:4px; font-size:13px; color:var(--primary-color-high, #1976d2);' }, [ICON.ARROW, TXT.WARNING.use_wizard_hint_title]),
		E('div', { 'style': 'color:var(--primary-color-high, #1976d2); margin-top:10px; padding:8px 12px; background:color-mix(in srgb, var(--primary-color-high, #1976d2) 10%, transparent); border-left:4px solid var(--primary-color-high, #1976d2); border-radius:4px;' }, [TXT.WARNING.use_wizard_hint_desc])
	]);

	const openWizardBtn = E('button', {
		'class': 'cbi-button cbi-button-apply important',
		'style': 'text-shadow: none !important; ' +
			'box-shadow: 0 4px 6px -1px color-mix(in srgb, var(--primary-color-high, #1976d2) 20%, transparent) !important; ' +
			'white-space: nowrap; ' +
			'padding: 6px 16px; ' +
			'font-weight: bold; ' +
			'display: inline-flex; ' +
			'align-items: center; ' +
			'justify-content: center; ' +
			'gap: 8px;' +
			styleHide
	}, [
		E('span', { 'style': 'font-size: 16px; line-height: 1;' }, ICON.ROCKET),
		E('span', {}, TXT.INFO.wizard + ' ...')
	]);


	const wizardButtonWrapperRow = E('div', {
		'style': 'display:flex; justify-content:flex-end; width:100%; margin-top:5px;' + styleHide
	}, [openWizardBtn]);

	const wizardHelperLayoutBlock = E('div', { 'style': 'display:block;' }, [
		dashedDivider,
		wizardAdvertNoticeBox,
		wizardButtonWrapperRow
	]);

	openWizardBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		L.ui.hideModal();
		callbacks.openWizardBtnClick(appData, null, true);
	});

	// Declared anonymous handler as ASYNC to authorize internal await callbacks.createInstance
	noBtn.addEventListener('click', async function (ev) {
		ev.preventDefault();
		L.ui.hideModal();
		await callbacks.createInstance(newInstanceItem, appData, wizardParams);
		callbacks.uciSaveApplyRestart(instance_id);
	});

	cancelBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		L.ui.hideModal();
	});

	// Declared anonymous handler as ASYNC to authorize internal await callbacks.createInstance
	yesBtn.addEventListener('click', async function (ev) {
		ev.preventDefault();
		yesBtn.style.display = 'none';
		noBtn.style.display = 'none';
		cancelBtn.style.display = 'none';
		promptMessageNode.style.display = 'none';
		wizardHelperLayoutBlock.style.display = 'none';
		progressTextArea.style.display = 'block';
		closeBtn.style.display = 'inline-block';
		closeBtn.disabled = true;
		closeBtn.className = 'cbi-button cbi-button-neutral';

		await callbacks.createInstance(newInstanceItem, appData, wizardParams);

		executeAsynchronousKeyGen(instance_id, KEYTYPE.pki, KEYTYPE.rsa2048_ec, KEYTYPE.y100, cnName, '', progressTextArea, callbacks.rpcFileCallbacks, function (pkiSuccess, pkiData, nullData) {
			if (!pkiSuccess || !pkiData) {
				progressTextArea.value += '\n' + ICON.ERROR + ' PKI generation failed.';
				closeBtn.disabled = false;
				closeBtn.className = 'cbi-button cbi-button-action important';
				return;
			}
			const log_separator_line = '\n\n--------------------------------------------------\n\n';
			progressTextArea.value += log_separator_line + ICON.ARROW + TXT.KEY.generate_tls_key + '\n';
			progressTextArea.scrollTop = progressTextArea.scrollHeight;

			executeAsynchronousKeyGen(instance_id, KEYTYPE.server_tls2, 'none', '0', cnName, '', progressTextArea, callbacks.rpcFileCallbacks, function (tlsSuccess, nullData, tlsData) {
				if (!tlsSuccess || !tlsData) {
					progressTextArea.value += '\n' + ICON.ERROR + 'TLS crypt v2 server master key generation failed.';
					closeBtn.disabled = false;
					closeBtn.className = 'cbi-button cbi-button-action important';
					return;
				}
				Promise.all([
					saveKeysToDisk(instance_id, KEYTYPE.pki, pkiData, null, callbacks.rpcFileCallbacks),
					saveKeysToDisk(instance_id, KEYTYPE.server_tls2, null, tlsData, callbacks.rpcFileCallbacks)
				]).then(function () {
					progressTextArea.value += '\n' + ICON.SAVE + ' ' + TXT.KEY.pki_saved + '\n' + ICON.SAVE + ' ' + TXT.KEY.tls_key_saved;
					progressTextArea.scrollTop = progressTextArea.scrollHeight;
					closeBtn.disabled = false;
					closeBtn.className = 'cbi-button cbi-button-action important';
				}).catch(function (err) {
					progressTextArea.value += '\n' + ICON.ERROR + ' Storage Write Failed: ' + err.message;
					closeBtn.disabled = false;
					closeBtn.className = 'cbi-button cbi-button-action important';
				});
			}, 'append');
		}, 'fresh');
	});

	closeBtn.addEventListener('click', function (ev) {
		ev.preventDefault();
		L.ui.hideModal();
		callbacks.uciSaveApplyRestart(instance_id);
	});

	L.ui.showModal(TXT.KEY.title_main + ' - ' + TXT.KEY.key_allocation + ' (' + instance_id + ')', [
		E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-section' }, [
				promptMessageNode,
				progressTextArea,
				buttonContainer,
				wizardHelperLayoutBlock
			])
		])
	]);
};

/**
 * Creates all structural visual elements for the key generator
 */
const createKeyGenUiElements = function (role, defaultName, appData) {
	// Render DH options and Client-PKI generation tools ONLY for active server profiles
	const isServer = (role === OPENVPN.ROLE.SERVER);
	const dhOptionHtml = isServer ? '<option value="' + KEYTYPE.dh + '">' + TXT.KEY.opt_dh + '</option>' : '';
	const tlsOptionHtml = isServer ? '<option value="' + KEYTYPE.server_tls2 + '">' + TXT.KEY.opt_tls_server + '</option>' : '<option value="' + KEYTYPE.client_tls2 + '">' + TXT.KEY.opt_tls_client + '</option>';
	const clientPkiOptionHtml = isServer ? '<option value="' + KEYTYPE.client_pki + '">' + TXT.KEY.client_ca_private_key_issued_by_ca + '</option>' : '';

	const fallbackCn = appData.wizardClass.getValidCommonName(defaultName);

	// Build the settings selectors using simple HTML string layers
	const optionsHtml = '<div class="cbi-value">' +
		'<label class="cbi-value-title">' + TXT.KEY.vpn_key_type + '</label>' +
		'<div class="cbi-value-field">' +
		'<select id="' + CFG.ID.central_keygen_mode + '" class="cbi-input-select">' +
		'<option value="' + KEYTYPE.pki + '" selected="selected">' + TXT.KEY.opt_full_pki + '</option>' +
		dhOptionHtml +
		tlsOptionHtml +
		clientPkiOptionHtml +
		'</select>' +
		'</div>' +
		'</div>' +

		'<div class="cbi-value">' +
		'<label class="cbi-value-title">' + TXT.KEY.key_strength + '</label>' +
		'<div class="cbi-value-field">' +
		'<select id="' + CFG.ID.keygen_bits_pki + '" class="cbi-input-select">' +
		'<option value="' + KEYTYPE.rsa2048_ec + '" selected>RSA-2048 + ECC - Prime256v1 (' + TXT.INFO.default + ')</option>' +
		'<option value="' + KEYTYPE.rsa4096_ec + '">RSA-4096 + ECC-Prime256v1</option>' +
		'<option value="' + KEYTYPE.ec + '">ECC Prime256v1 (' + TXT.KEY.pure_ecc + ')</option>' +
		'<option value="' + KEYTYPE.b2048 + '">RSA 2048 Bit (' + TXT.KEY.pure_rsa + ')</option>' +
		'<option value="' + KEYTYPE.b4096 + '">RSA 4096 Bit (' + TXT.KEY.pure_rsa + ')</option>' +
		'</select>' +
		'<select id="' + CFG.ID.keygen_bits_dh + '" class="cbi-input-select" style="display:none;">' +
		'<option value="' + KEYTYPE.b2048 + '" selected>2048 Bit (' + TXT.INFO.default + ')</option>' +
		'<option value="' + KEYTYPE.b4096 + '">4096 Bit</option>' +
		'</select>' +
		'<div id="' + CFG.ID.keygen_bits_desc + '" class="cbi-value-description" style="margin-top:4px; font-size:11px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);">' + TXT.KEY.strength_description + '</div>' +
		'</div>' +
		'</div>' +

		'<div class="cbi-value" id="' + CFG.ID.row_keygen_years + '">' +
		'<label class="cbi-value-title">' + TXT.KEY.validity_days + '</label>' +
		'<div class="cbi-value-field">' +
		'<select id="' + CFG.ID.keygen_years + '" class="cbi-input-select">' +
		'<option value="10">10 ' + TXT.INFO.years + '</option>' +
		'<option value="20">20 ' + TXT.INFO.years + '</option>' +
		'<option value="50">50 ' + TXT.INFO.years + '</option>' +
		'<option value="' + KEYTYPE.y100 + '" selected="selected">100 ' + TXT.INFO.years + ' (' + TXT.INFO.default + ')</option>' +
		'</select>' +
		'</div>' +
		'</div>' +

		'<div class="cbi-value" id="' + CFG.ID.row_keygen_cn + '" style="display:flex;">' +
		'<label class="cbi-value-title">' + TXT.KEY.common_name + '</label>' +
		'<div class="cbi-value-field">' +
		'<input id="' + CFG.ID.keygen_cn + '" type="text" class="cbi-input-text" style="width:100%; font-weight: bold;" value="' + fallbackCn + '" placeholder="' + TXT.KEY.placeholder_cn + '">' +
		'<div class="cbi-value-description" style="margin-top:4px; font-size:11px; color:color-mix(in srgb, var(--text-color-medium, #71717a) 85%, #0055ff);">' + TXT.KEY.use_unique_name_for_each_office + '</div>' +
		'</div>' +
		'</div>';

	const customCli = E('input', { 'id': 'keygen_custom_cmd', 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:100%; margin-top:5px;' });
	const textArea = E('textarea', {
		'id': 'keygen_output',
		'class': 'cbi-input-textarea',
		'rows': '12',
		'readonly': 'readonly',
		'style': 'width: 100%; ' +
			'max-width: 100%; ' +
			'resize: vertical; ' +
			'font-family: var(--font-monospace, monospace); ' +
			'font-size: 12px; ' +
			'background: #18181b; ' +
			'color: #4ade80 !important; ' +
			'padding: 15px; ' +
			'border-radius: 4px; ' +
			'border: 1px solid var(--border-color-medium, #cbd5e1); ' +
			'text-shadow: none !important; ' +
			'line-height: 1.5;'
	}, [TXT.KEY.ready]);

	const warnBox = E('div', {
		'class': 'cbi-value',
		'style': 'background: color-mix(in srgb, var(--warn-color-high, #efbd0b) 18%, transparent); ' +
			'display:none !important; ' +
			'border-left: 4px solid var(--warn-color-high, #efbd0b); ' +
			'padding: 10px; ' +
			'margin: 10px; ' +
			'border-radius: 4px;'
	}, [
		E('div', {
			'style': 'color: var(--text-color-high, #3f3f46); font-weight: bold; line-height: 1.5;'
		}, [ICON.WARNING, TXT.WARNING.clicking_save_will_break_vpn])
	]);

	const optionsBox = E('div', { 'id': 'central_options_container' });
	optionsBox.innerHTML = optionsHtml;

	return {
		nodes: { warn: warnBox, options: optionsBox, customCli: customCli, output: textArea },
		buttons: {
			generate: E('button', { 'class': 'cbi-button cbi-button-action', 'style': 'margin-right:10px;' }, TXT.BTN.generate),
			save: E('button', { 'class': 'cbi-button cbi-button-save disabled', 'style': 'margin-right:10px; opacity: 0.5;', 'disabled': true }, TXT.BTN.save_config),
			export: E('button', { 'class': 'cbi-button cbi-button-action important disabled', 'style': 'margin-right:10px; opacity: 0.5; display:none;', 'disabled': true }, ICON.EXPORT + ' ' + TXT.KEY.export_keys),
			close: E('button', { 'class': 'cbi-button cbi-button-neutral' }, TXT.BTN.close)
		}
	};
};

/**
 * Connects all interactive timers, actions and file saving events
 */
const setupKeyGenEvents = function (ui, instance_id, state, appData, uciSaveApplyRestartCallback, rpcFileCallbacks) {
	// Use ui.nodes.options to safely find the unique mode dropdown element layout
	const modeSelect = (ui.nodes && ui.nodes.options) ? ui.nodes.options.querySelector('#' + CFG.ID.central_keygen_mode) : null;

	if (!modeSelect) {
		console.warn('Central keygen mode select dropdown element not found inside UI schema.');
		return;
	}

	const updateKeyStrengthDropdowns = function () {
		const pkiSelect = document.getElementById(CFG.ID.keygen_bits_pki);
		const dhSelect = document.getElementById(CFG.ID.keygen_bits_dh);
		const descContainer = document.getElementById(CFG.ID.keygen_bits_desc);

		if (!pkiSelect || !dhSelect || !descContainer) return;

		// Dynamic visibility tracking including the client_pki option
		if (state.mode === KEYTYPE.pki || state.mode === KEYTYPE.client_pki) {
			pkiSelect.style.display = 'inline-block';
			dhSelect.style.display = 'none';
			descContainer.textContent = TXT.KEY.strength_description;
		} else if (state.mode === KEYTYPE.dh) {
			pkiSelect.style.display = 'none';
			dhSelect.style.display = 'inline-block';
			descContainer.textContent = TXT.KEY.dh_description;
		} else if (state.mode === KEYTYPE.server_tls2) {
			pkiSelect.style.display = 'none';
			dhSelect.style.display = 'none';
			descContainer.textContent = TXT.KEY.tls_description_server;
		} else if (state.mode === KEYTYPE.client_tls2) {
			pkiSelect.style.display = 'none';
			dhSelect.style.display = 'none';
			descContainer.textContent = TXT.KEY.tls_description_client;
		}

	};

	const updateCustomCliPlaceholder = function () {
		if (!ui.nodes || !ui.nodes.customCli) return;
		ui.nodes.customCli.value = '';

		// Added specific placeholder rules layout mapping for the client keys generator mode
		if (state.mode === KEYTYPE.pki) {
			ui.nodes.customCli.placeholder = TXT.KEY.placeholder_pki;
			ui.nodes.customCli.disabled = false;
			ui.nodes.customCli.style.opacity = '0.5';
		} else if (state.mode === KEYTYPE.client_pki) {
			ui.nodes.customCli.placeholder = TXT.KEY.placeholder_pki_client;
			ui.nodes.customCli.disabled = false;
			ui.nodes.customCli.style.opacity = '0.5';
		} else if (state.mode === KEYTYPE.dh) {
			ui.nodes.customCli.placeholder = TXT.KEY.placeholder_dh;
			ui.nodes.customCli.disabled = false;
			ui.nodes.customCli.style.opacity = '0.5';
		} else if ((state.mode === KEYTYPE.server_tls2) || (state.mode === KEYTYPE.client_tls2)) {
			ui.nodes.customCli.placeholder = TXT.KEY.placeholder_tls;
			ui.nodes.customCli.disabled = true;
			ui.nodes.customCli.style.opacity = '0.2';
		}
	};

	modeSelect.addEventListener('change', function (ev) {
		ev.preventDefault();
		state.mode = ev.target.value;

		const rowYears = document.getElementById(CFG.ID.row_keygen_years);
		const rowCn = document.getElementById(CFG.ID.row_keygen_cn);
		const saveBtn = ui.buttons.save;
		const exportBtn = ui.buttons.export;

		if (ui.nodes.warn) ui.nodes.warn.style.display = 'none';

		// Toggle distinct button visibilities and the Common Name row layer instantly
		if (state.mode === KEYTYPE.client_pki) {
			saveBtn.style.display = 'none';
			exportBtn.style.display = 'inline-block';
			exportBtn.enabled = false;
			exportBtn.style.opacity = '0.5';

			if (rowYears) rowYears.style.display = 'flex';
			if (rowCn) rowCn.style.display = 'flex';
		} else {
			saveBtn.style.display = 'inline-block';
			saveBtn.enabled = false;
			saveBtn.style.opacity = '0.5';
			exportBtn.style.display = 'none';

			if (state.mode === KEYTYPE.pki) {
				// Show Common Name field for server PKI setups
				if (rowYears) rowYears.style.display = 'flex';
				if (rowCn) rowCn.style.display = 'flex';
			} else {
				if (rowYears) rowYears.style.display = 'none';
				if (rowCn) rowCn.style.display = 'none';
			}
		}

		updateKeyStrengthDropdowns();
		updateCustomCliPlaceholder();
	});

	ui.buttons.generate.addEventListener('click', function (ev) {
		ev.preventDefault();
		const selectedYears = document.getElementById(CFG.ID.keygen_years) ? document.getElementById(CFG.ID.keygen_years).value : KEYTYPE.y100;
		const baseCustomArgs = (ui.nodes.customCli && ui.nodes.customCli.value) ? sanitizeInputLine(ui.nodes.customCli.value) : '';
		let finalCn = '';
		state.isGenerated = false;

		if (state.mode === KEYTYPE.pki || state.mode === KEYTYPE.client_pki) {
			const cnInput = document.getElementById(CFG.ID.keygen_cn);
			finalCn = cnInput ? appData.wizardClass.getValidCommonName(cnInput.value) : '';
		}

		let rawBitsSelection = KEYTYPE.b2048;
		if (state.mode === KEYTYPE.pki || state.mode === KEYTYPE.client_pki) {
			rawBitsSelection = document.getElementById(CFG.ID.keygen_bits_pki).value;
		} else if (state.mode === KEYTYPE.dh) {
			rawBitsSelection = document.getElementById(CFG.ID.keygen_bits_dh).value;
		}

		ui.buttons.generate.disabled = true;
		ui.buttons.save.disabled = true;
		ui.buttons.save.style.opacity = '0.5';
		ui.buttons.export.disabled = true;
		ui.buttons.export.style.opacity = '0.5';
		modeSelect.disabled = true;

		// STEP 1: Start core asynchronous cryptographic generation
		executeAsynchronousKeyGen(instance_id, state.mode, rawBitsSelection, selectedYears, finalCn, baseCustomArgs, ui.nodes.output, rpcFileCallbacks, function (isSuccessful, pkiData, singleData) {
			if (isSuccessful) {
				// Scenario A: If a Site-to-Site client bundle is requested, chain the asymmetric client token derivation instantly
				if (state.mode === KEYTYPE.client_pki) {
					const log_separator_line = '\n\n--------------------------------------------------\n\n';
					ui.nodes.output.value += log_separator_line + ICON.ARROW + _('Generating TLS crypt v2 client key...') + '\n';
					ui.nodes.output.scrollTop = ui.nodes.output.scrollHeight;

					// STEP 2: Asynchronously generate the client-tls2 credentials into the volatile RAM buffer
					executeAsynchronousKeyGen(instance_id, KEYTYPE.client_tls2, 'none', '0', finalCn, '', ui.nodes.output, rpcFileCallbacks, function (tlsSuccess, nullData, tlsData) {
						ui.buttons.generate.disabled = false;
						modeSelect.disabled = false;

						if (!tlsSuccess || !tlsData) {
							ui.nodes.output.value += '\n' + ICON.ERROR + ' TLS crypt v2 client key generation failed.';
							return;
						}

						// Package both components cleanly into the operational memory context state variables
						state.isGenerated = true;
						state.pkiData = pkiData;
						state.singleData = tlsData;

						ui.buttons.export.disabled = false;
						ui.buttons.export.style.opacity = '1';
					}, 'append');

				} else {
					// Scenario B: Standard processing path for single-stage assets (PKI, DH, server-tls2)
					ui.buttons.generate.disabled = false;
					modeSelect.disabled = false;
					state.isGenerated = true;
					state.pkiData = pkiData;
					state.singleData = singleData;

					if (!ui.buttons.save.dataset.confirmSave) {
						if ((state.mode === KEYTYPE.pki) || (state.mode === KEYTYPE.server_tls2) || (state.mode === KEYTYPE.client_tls2)) {
							if (ui.nodes.warn) ui.nodes.warn.style.display = 'block';
							ui.buttons.save.textContent = ICON.WARNING + TXT.BTN.enable_save;
							ui.buttons.save.dataset.confirmSave = 'true';
						}
					}

					ui.buttons.save.disabled = false;
					ui.buttons.save.style.opacity = '1';
				}
			} else {
				// Central fallback handler if Step 1 crashes out early
				ui.buttons.generate.disabled = false;
				modeSelect.disabled = false;
			}
		}, 'fresh');
	});

	// action listener reserved strictly for local disk writing configurations
	ui.buttons.save.addEventListener('click', function (ev) {

		ev.preventDefault();
		if (!state.isGenerated) return;
		if (ui.buttons.save.dataset.confirmSave) {
			delete ui.buttons.save.dataset.confirmSave;
			ui.buttons.save.textContent = TXT.BTN.save_config;
			return;
		}

		ui.buttons.save.disabled = true;
		ui.buttons.save.style.opacity = '0.5';

		saveKeysToDisk(instance_id, state.mode, state.pkiData, state.singleData, rpcFileCallbacks)
			.then(function () {
				state.hasSaved = true;
				state.isGenerated = false;
				ui.nodes.output.value += '\n\n' + ICON.SAVE + ' ' + TXT.BTN.saved;
				ui.nodes.output.scrollTop = ui.nodes.output.scrollHeight;
			})
			.catch(function (err) {
				ui.buttons.save.disabled = false;
				ui.buttons.save.style.opacity = '1';
				ui.nodes.output.value += '\n' + ICON.ERROR + ' ' + err.message;
			});
	});

	// action listener reserved strictly for raw cryptographic keys export (.crt bundle)
	ui.buttons.export.addEventListener('click', async function (ev) {
		ev.preventDefault();
		if (!state.isGenerated) return;

		ui.buttons.export.disabled = true;
		ui.buttons.save.style.opacity = '0.5';

		const rawCaContent = state.pkiData ? state.pkiData.ca : '';
		const clientCertContent = state.pkiData ? state.pkiData.cert : '';
		const clientKeyContent = state.pkiData ? state.pkiData.key : '';

		// SECURITY FILTER: Strip out the secret CA Private Key block completely if it exists in the data
		const cleanCaContent = rawCaContent.replace(/-----BEGIN[^\n]*PRIVATE KEY-----[\s\S]*?-----END[^\n]*PRIVATE KEY-----\n*/g, '');

		// Assemble <ca>...</ca> <cert>...</cert> <key>...</key> <tls-crypt>...</tls-crypt>
		let cryptoBundlePayload = cleanCaContent.trim() + '\n\n'
			+ clientCertContent.trim() + '\n\n'
			+ clientKeyContent.trim() + '\n';

		if (state.singleData) {
			cryptoBundlePayload += '\n' + state.singleData.trim() + '\n';
		}

		const cnInput = document.getElementById(CFG.ID.keygen_cn);
		const userEnteredName = cnInput ? cnInput.value : '';
		let cleanFilename = appData.wizardClass.getValidCommonName(userEnteredName);
		if (!cleanFilename) {
			cleanFilename = 'client_' + instance_id;
		}

		const blob = new Blob([cryptoBundlePayload], { type: 'application/x-x509-ca-cert' });
		const link = E('a', {
			href: URL.createObjectURL(blob),
			download: 'keys_' + cleanFilename + '.crt'
		});

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		ui.buttons.export.disabled = false;
		ui.buttons.export.style.opacity = '1';
		ui.nodes.output.value += '\n\n' + ICON.SUCCESS + ' ' + TXT.KEY.client_keys_exported;
	});

	ui.buttons.close.addEventListener('click', function (ev) {
		ev.preventDefault();
		if (state.isGenerated && !window.confirm(TXT.WARNING.key_not_saved)) return;
		L.ui.hideModal();
		if (state.hasSaved) {
			uciSaveApplyRestartCallback(instance_id);
		}
	});

	// Trigger initial UI setup alignments
	updateKeyStrengthDropdowns();
	updateCustomCliPlaceholder();
};

/**
 * Opens the key generator window to create keys and certificates (Slim and Modular)
 */
const openKeyGenModal = function (instance_id, displayId, role, appData, uciSaveApplyRestartCallback, rpcFileCallbacks) {
	// Create the configuration elements and buttons using our sub-routines
	const ui = createKeyGenUiElements(role, displayId, appData);

	// Group the mutable state variables inside a single state context object
	const state = {
		mode: KEYTYPE.pki,
		isGenerated: false,
		hasSaved: false,
		pkiData: null,
		singleData: null
	};

	// Setup all interactive listeners and event routing logic
	setupKeyGenEvents(ui, instance_id, state, appData, uciSaveApplyRestartCallback, rpcFileCallbacks);

	// Render the complete key generator overlay view layout structure
	L.ui.showModal(TXT.KEY.title_main + ' (' + displayId + ')', [
		E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-section' }, [
				ui.nodes.options,

				// Layout row for the custom cli input box
				E('div', { 'style': 'margin-top:20px; padding:0 10px;' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'display:block; font-weight:bold; margin-bottom:5px; float:none; text-align:left; width:100%;' }, [TXT.KEY.custom_cli]),
					E('div', { 'style': 'width:100%;' }, [ui.nodes.customCli])
				]),

				// Layout row for the progress log output box
				E('div', { 'style': 'margin-top:20px; padding:0 10px;' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'display:block; font-weight:bold; margin-bottom:8px; float:none; text-align:left; width:100%;' }, [TXT.KEY.progress]),
					E('div', { 'style': 'width:100%;' }, [ui.nodes.output])
				]),

				ui.nodes.warn,

				E('div', { 'style': 'text-align:right; margin-top:20px;' }, [
					ui.buttons.generate,
					ui.buttons.save,
					ui.buttons.export,
					ui.buttons.close
				])
			])
		])
	]);
};

/**
 * Export the open wizard modal function to LuCI
 */
return L.Class.extend(
	{
		KEYTYPE: KEYTYPE,
		executeAsynchronousKeyGen: executeAsynchronousKeyGen,
		openKeyEditorModal: openKeyEditorModal,
		openAutomatedPostKeyGenModal: openAutomatedPostKeyGenModal,
		openKeyGenModal: openKeyGenModal
	});

