/* Licensed to the public under the Apache License 2.0. */

'use strict';

return L.Class.extend({
	title: _('DSL'),

	rrdargs: function (graph, host, plugin, plugin_instance, dtype) {
		var g = [];
		var dtypes = graph.dataTypes(host, plugin, plugin_instance);

		const d_uptime = {
			title: _('%H: Line uptime on %pi'),
			vlabel: 'seconds',
			number_format: '%8.0lf s',
			alt_autoscale_max: true,
			y_min: 0,
			data: {
				types: ['uptime'],
				options: {
					uptime: {
						title: _('Uptime'),
						noarea: true,
						noavg: true,
					},
				},
			},
		};

		const d_snr = {
			title: _('%H: SNR on %pi'),
			vlabel: 'dB',
			number_format: '%5.1lf dB',
			data: {
				types: ['snr'],
				instances: {
					snr: ['down', 'up'],
				},
				options: {
					snr_down: {
						title: _('SNR Margin Down'),
						weight: 1,
					},
					snr_up: {
						title: _('SNR Margin Up'),
						flip: true,
						weight: 2,
					},
				},
			},
		};

		const d_atn = {
			title: _('%H: Attenuation on %pi'),
			vlabel: 'dB',
			number_format: '%5.1lf dB',
			data: {
				types: ['gauge'],
				instances: {
					snr: ['latn_down', 'satn_down', 'latn_up', 'satn_up'],
				},
				options: {
					gauge_latn_down: {
						title: _('Line Attenuation Down'),
						noarea: true,
						overlay: true,
						weight: 1,
					},
					gauge_satn_down: {
						title: _('Signal Attenuation Down'),
						flip: false,
						noarea: true,
						overlay: true,
						weight: 1,
					},
					gauge_latn_up: {
						title: _('Line Attenuation Up'),
						flip: true,
						noarea: true,
						overlay: true,
						weight: 2,
					},
					gauge_satn_up: {
						title: _('Signal Attenuation Up'),
						flip: true,
						noarea: true,
						overlay: true,
						weight: 2,
					},
				},
			},
		};

		const d_flags = {
			title: _('%H: Line flags on %pi'),
			data: {
				types: ['bool'],
				instances: {
					bool: ['bitswap_down', 'vector_down', 'bitswap_up', 'vector_up'],
				},
				options: {
					bool_bitswap_down: {
						title: _('Bitswap Down'),
						noarea: true,
						overlay: true,
						weight: 1,
					},
					bool_vector_down: {
						title: _('Vectoring Down'),
						noarea: true,
						overlay: true,
						weight: 1,
					},
					bool_bitswap_up: {
						title: _('Bitswap Up'),
						flip: true,
						noarea: true,
						overlay: true,
						weight: 2,
					},
					bool_vector_up: {
						title: _('Vectoring Up'),
						flip: true,
						noarea: true,
						overlay: true,
						weight: 2,
					},
				},
			},
		};

		const d_bitrate = {
			title: _('%H: Data rate on %pi'),
			vlabel: 'b/s',
			number_format: '%5.1lf%sb/s',
			data: {
				types: ['bitrate'],
				instances: {
					bitrate: [
						'data_rate_down',
						'attndr_down',
						'data_rate_up',
						'attndr_up',
					],
				},
				options: {
					bitrate_data_rate_down: {
						title: _('Data Rate Down'),
						noarea: false,
						overlay: true,
						weight: 1,
					},
					bitrate_attndr_down: {
						title: _('Attainable Data Rate Down'),
						noarea: true,
						overlay: true,
						weight: 1,
					},
					bitrate_data_rate_up: {
						title: _('Data Rate Up'),
						flip: true,
						noarea: false,
						overlay: true,
						weight: 2,
					},
					bitrate_attndr_up: {
						title: _('Attainable Data Rate Up'),
						flip: true,
						noarea: true,
						overlay: true,
						weight: 2,
					},
				},
			},
		};

		const d_errors = {
			title: _('%H: Errored seconds on %pi'),
			number_format: '%8.0lf',
			totals_format: '%5.0lf%s',
			vlabel: 'seconds',
			data: {
				types: ['errors'],
				instances: {
					errors: [
						'es',
						'ses',
						'loss',
						'uas',
						'f_es',
						'f_ses',
						'f_loss',
						'f_uas',
					],
				},
				options: {
					errors_es_near: {
						title: _('Errored seconds'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 1,
					},
					errors_ses_near: {
						title: _('Severely Errored Seconds'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 1,
					},
					errors_loss_near: {
						title: _('Loss of Signal Seconds'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 1,
					},
					errors_uas_near: {
						title: _('Unavailable Seconds'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 1,
					},
					errors_es_far: {
						title: _('Far Errored Seconds'),
						overlay: true,
						noarea: true,
						flip: true,
						total: true,
						weight: 2,
					},
					errors_ses_far: {
						title: _('Far Severely Errored Seconds'),
						overlay: true,
						noarea: true,
						flip: true,
						total: true,
						weight: 2,
					},
					errors_loss_far: {
						title: _('Far Loss of Signal Seconds'),
						overlay: true,
						noarea: true,
						flip: true,
						total: true,
						weight: 2,
					},
					errors_uas_far: {
						title: _('Far Unavailable Seconds'),
						overlay: true,
						noarea: true,
						flip: true,
						total: true,
						weight: 2,
					},
				},
			},
		};

		const d_retx = {
			title: _('%H: RETX Errors %pi'),
			vlabel: 'count',
			number_format: '%8.0lf',
			totals_format: '%5.0lf%s',
			data: {
				types: ['errors'],
				instances: {
					errors: [
						'rx_corrupted',
						'rx_uncorrected_protected',
						'rx_retransmitted',
						'rx_corrected',
						'tx_retransmitted',
					],
				},
				options: {
					errors_rx_corrupted: {
						title: _('RX Corrupted'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 1,
					},
					errors_rx_uncorrected_protected: {
						title: _('RX Uncorrected Protected'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 1,
					},
					errors_rx_retransmitted: {
						title: _('RX Retransmitted'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 1,
					},
					errors_rx_corrected: {
						title: _('RX Corrected'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 1,
					},
					errors_tx_retransmitted: {
						title: _('TX Retransmitted'),
						overlay: true,
						noarea: true,
						total: true,
						weight: 2,
					},
				},
			},
		};

		const d_crc = {
			title: _('%H: CRC Errors on %pi'),
			vlabel: 'errors',
			number_format: '%8.0lf',
			totals_format: '%5.0lf%s',
			data: {
				types: ['errors'],
				instances: {
					errors: ['crc', 'crcp', 'f_crc', 'f_crcp'],
				},
				options: {
					errors_crc_p_near: {
						title: _('CRC Errors'),
						overlay: true,
						noarea: true,
						total: true,
					},
					errors_crcp_p_near: {
						title: _('Pre-emptive CRC Errors'),
						overlay: true,
						noarea: true,
						total: true,
					},
					errors_crc_p_far: {
						title: _('Far CRC Errors'),
						overlay: true,
						noarea: true,
						total: true,
						flip: true,
					},
					errors_crcp_p_far: {
						title: _('Far Pre-emptive CRC Errors'),
						overlay: true,
						noarea: true,
						total: true,
						flip: true,
					},
				},
			},
		};

		if (dtypes.includes('snr')) {
			g.push(d_snr);
		}
		if (dtypes.includes('gauge')) {
			g.push(d_atn);
		}
		if (dtypes.includes('uptime')) {
			g.push(d_uptime);
		}
		if (dtypes.includes('bool')) {
			g.push(d_flags);
		}
		if (dtypes.includes('bitrate')) {
			g.push(d_bitrate);
		}
		if (dtypes.includes('errors')) {
			var dinsts = graph.dataInstances(host, plugin, plugin_instance, 'errors');
			var e = 0,
				c = 0,
				r = 0;
			for (var i = 0; i < dinsts.length; i++) {
				if (
					!e &&
					(dinsts[i].indexOf('es') > -1 ||
						dinsts[i].indexOf('loss') > -1 ||
						dinsts[i].indexOf('uas') > -1)
				) {
					e = g.push(d_errors);
				} else if (!c && dinsts[i].indexOf('crc') > -1) {
					c = g.push(d_crc);
				} else if (
					!r &&
					(dinsts[i].indexOf('rx_') == 0 || dinsts[i].indexOf('tx_') == 0)
				) {
					r = g.push(d_retx);
				}
			}
		}

		return g;
	},
});
