/* Licensed to the public under the Apache License 2.0. */

'use strict';

return L.Class.extend({
	title: _('DSL'),

	rrdargs:  function(graph, host, plugin, plugin_instance, dtype) {
		var g = [];

		g.push({
			title: "DSL Signal",
			vlabel: "dB",
			data: {
				types: ["snr"],
				options: {
					snr_latn_up: {
						title: "Line Attenuation Up (LATN)",
						noarea: true,
						overlay: true
					},
					snr_latn_down: {
						title: "Line Attenuation Down (LATN)",
						noarea: true,
						overlay: true
					},
					snr_satn_up: {
						title: "Signal Attenuation Up (SATN)",
						noarea: true,
						overlay: true
					},
					snr_satn_down: {
						title: "Signal Attenuation Down (SATN)",
						noarea: true,
						overlay: true
					},
					snr_snr_up: {
						title: "Noise Margin Up (SNR)",
						noarea: true,
						overlay: true
					},
					snr_snr_down: {
						title: "Noise Margin Down (SNR)",
						noarea: true,
						overlay: true
					},
				}
			}
		});
		g.push({
			title: "DSL Line Uptime",
			vlabel: "seconds",
			data: {
				types: ["uptime"],
				options: {
					uptime: {
						title: "Uptime",
						noarea: true
					}
				}
			}
		});
		g.push({
			title: "DSL Flags",
			data: {
				instances: {
					bool: [
						"bitswap_up",
						"bitswap_down",
						"vector_up",
						"vector_down"
					]
				},
				options: {
					bool_bitswap_up: {
						title: "Bitswap Up",
						noarea: true,
						overlay: true
					},
					bool_bitswap_down: {
						title: "Bitswap Down",
						noarea: true,
						overlay: true
					},
					bool_vector_up: {
						title: "Vectoring Up",
						noarea: true,
						overlay: true
					},
					bool_vector_down: {
						title: "Vectoring Down",
						noarea: true,
						overlay: true
					},
				}
			}
		});
		g.push({
			title: "Bitrate",
			vlabel: "b/s",
			data: {
				instances: {
					bitrate: [
						"attndr_up",
						"attndr_down",
						"data_rate_up",
						"data_rate_down"
					]
				},
				options: {
					bitrate_attndr_up: {
						title: "Attenuation Up (ATTNDR)",
						noarea: true,
						overlay: true
					},
					bitrate_attndr_down: {
						title: "Attenuation Down (ATTNDR)",
						noarea: true,
						overlay: true
					},
					bitrate_data_rate_up: {
						title: "Data Rate Up",
						noarea: true,
						overlay: true
					},
					bitrate_data_rate_down: {
						title: "Data Rate Down",
						noarea: true,
						overlay: true
					}
				}
			}
		});
		g.push({
			title: "Errors",
			vlabel: "count",
			data: {
				types: ["errors"],
				options: {
					errors_rx_corrupted_far: {
						title: "Rx Corrupted Far",
						noarea: true,
						overlay: true
					},
					errors_rx_corrupted_near: {
						title: "Rx Corrupted Near",
						noarea: true,
						overlay: true
					},
					errors_rx_retransmitted_far: {
						title: "Rx Retransmitted Far",
						noarea: true,
						overlay: true
					},
					errors_tx_retransmitted_far: {
						title: "Tx Retransmitted Far",
						noarea: true,
						overlay: true
					},
					errors_rx_retransmitted_near: {
						title: "Rx Retransmitted Near",
						noarea: true,
						overlay: true
					},
					errors_tx_retransmitted_near: {
						title: "Tx Retransmitted Near",
						noarea: true,
						overlay: true
					},
				}
			}
		});
		return g;
	}
});
