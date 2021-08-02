/*
 * Copyright 2011 Manuel Munz <freifunk at somakoma dot de>
 * Licensed to the public under the Apache License 2.0.
 */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('DNS'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var traffic = {
			title: "%H: DNS traffic", vlabel: "Bit/s",

			data: {
				sources: {
					dns_octets: [ "queries", "responses" ]
				},

				options: {
					dns_octets__responses: {
						total: true,
						color: "00ff00",
						title: "Responses"
					},

					dns_octets__queries: {
						total: true,
						color: "0000ff",
						title: "Queries"
					}
				}
			}
		};

		var opcode_query = {
			title: "%H: DNS Opcode Query", vlabel: "Queries/s",
			data: {
				instances: {
					dns_opcode: [ "Query" ]
				},

				options: {
					dns_opcode_Query_value: {
						total: true,
						color: "0000ff",
						title: "Queries/s"
					}
				}
			}
		};

		var qtype = {
			title: "%H: DNS QType", vlabel: "Queries/s",
			data: {
				sources: { dns_qtype: [ "" ] },
				options: {
					dns_qtype_A6_		: { title: "A6"         , noarea: true, total: true },
					dns_qtype_AAAA_		: { title: "AAAA"       , noarea: true, total: true },
					dns_qtype_ANY_		: { title: "ANY"        , noarea: true, total: true },
					dns_qtype_A_		: { title: "A"          , noarea: true, total: true },
					dns_qtype_AXFR_		: { title: "AXFR"       , noarea: true, total: true },
					dns_qtype_CAA_		: { title: "CAA"        , noarea: true, total: true },
					dns_qtype_CERT_		: { title: "CERT"       , noarea: true, total: true },
					dns_qtype_CNAME_	: { title: "CNAME"      , noarea: true, total: true },
					dns_qtype_DNAME_	: { title: "DNAME"      , noarea: true, total: true },
					dns_qtype_DNSKEY_	: { title: "DNSKEY"     , noarea: true, total: true },
					dns_qtype_DS_		: { title: "DS"         , noarea: true, total: true },
					dns_qtype_HIP_		: { title: "HIP"        , noarea: true, total: true },
					dns_qtype_HINFO_	: { title: "HINFO"      , noarea: true, total: true },
					dns_qtype_IXFR_		: { title: "IXFR"       , noarea: true, total: true },
					dns_qtype_KEY_		: { title: "KEY"        , noarea: true, total: true },
					dns_qtype_KX_		: { title: "KX"         , noarea: true, total: true },
					dns_qtype_LOC_		: { title: "LOC"        , noarea: true, total: true },
					dns_qtype_MAILA_	: { title: "MAILA"      , noarea: true, total: true },
					dns_qtype_MAILB_	: { title: "MAILB"      , noarea: true, total: true },
					dns_qtype_MX_		: { title: "MX"         , noarea: true, total: true },
					dns_qtype_NAPTR_	: { title: "NAPTR"      , noarea: true, total: true },
					dns_qtype_NSAP_PTR_	: { title: "NSAP_PTR"   , noarea: true, total: true },
					dns_qtype_NSAP_		: { title: "NSAP"       , noarea: true, total: true },
					dns_qtype_NSEC3PARAM_	: { title: "NSEC3PARAM" , noarea: true, total: true },
					dns_qtype_NSEC3_	: { title: "NSEC3"      , noarea: true, total: true },
					dns_qtype_NSEC_		: { title: "NSEC"       , noarea: true, total: true },
					dns_qtype_NS_		: { title: "NS"         , noarea: true, total: true },
					dns_qtype_NULL_		: { title: "NULL"       , noarea: true, total: true },
					dns_qtype_OPT_		: { title: "OPT"        , noarea: true, total: true },
					dns_qtype_PTR_		: { title: "PTR"        , noarea: true, total: true },
					dns_qtype_RP_		: { title: "RP"         , noarea: true, total: true },
					dns_qtype_RRSIG_	: { title: "RRSIG"      , noarea: true, total: true },
					dns_qtype_SIG_		: { title: "SIG"        , noarea: true, total: true },
					dns_qtype_SMIMEA_	: { title: "SMIMEA"     , noarea: true, total: true },
					dns_qtype_SOA_		: { title: "SOA"        , noarea: true, total: true },
					dns_qtype_SRV_		: { title: "SRV"        , noarea: true, total: true },
					dns_qtype_TKEY_		: { title: "TKEY"       , noarea: true, total: true },
					dns_qtype_TLSA_		: { title: "TLSA"       , noarea: true, total: true },
					dns_qtype_TSIG_		: { title: "TSIG"       , noarea: true, total: true },
					dns_qtype_TXT_		: { title: "TXT"        , noarea: true, total: true },
					dns_qtype_WKS_		: { title: "WKS"        , noarea: true, total: true },
				},
			}
		};

		return [ traffic, opcode_query, qtype ];
	}
});
