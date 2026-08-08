'use strict';
'require baseclass';

/* Shared cellular band/frequency helpers for the wwand LuCI packages
   (status page and the proto handler). Single source of truth so the band
   tables are not copy-pasted across resources.

   E-UTRA (LTE) downlink band table: [band, earfcn_low, earfcn_high, fdl_low_mhz]
   from 3GPP TS 36.101 Table 5.7.3-1. Frequency = fdl_low + 0.1*(earfcn -
   earfcn_low). EARFCN ranges are disjoint, so order does not matter here. */
var LTE_BANDS = [
	[1,0,599,2110],[2,600,1199,1930],[3,1200,1949,1805],[4,1950,2399,2110],
	[5,2400,2649,869],[6,2650,2749,875],[7,2750,3449,2620],[8,3450,3799,925],
	[9,3800,4149,1844.9],[10,4150,4749,2110],[11,4750,4999,1475.9],
	[12,5010,5179,729],[13,5180,5279,746],[14,5280,5379,758],[17,5730,5849,734],
	[18,5850,5999,860],[19,6000,6149,875],[20,6150,6449,791],[21,6450,6599,1495.9],
	[22,6600,7399,3510],[23,7500,7699,2180],[24,7700,8039,1525],[25,8040,8689,1930],
	[26,8690,9039,859],[27,9040,9209,852],[28,9210,9659,758],[29,9660,9769,717],
	[30,9770,9869,2350],[31,9870,9919,462.5],[32,9920,10359,1452],
	[33,36000,36199,1900],[34,36200,36349,2010],[35,36350,36949,1850],
	[36,36950,37549,1930],[37,37550,37749,1910],[38,37750,38249,2570],
	[39,38250,38649,1880],[40,38650,39649,2300],[41,39650,41589,2496],
	[42,41590,43589,3400],[43,43590,45589,3600],[44,45590,46589,703],
	[46,46790,54539,5150],[48,55240,56739,3550],[65,65536,66435,2110],
	[66,66436,67335,2110],[68,67536,67835,753],[70,68336,68585,1995],
	[71,68586,68935,617]
];

/* NR (5G) downlink band table: ['n<band>', fdl_low_mhz, fdl_high_mhz] from
   3GPP TS 38.101-1 (FR1) / -2 (FR2). Ordered narrower-before-broader where
   ranges overlap, since nrArfcn() returns the first match (e.g. n78 before
   n77, n1 before n65/n66). Covers the common FR1 bands + FR2 mmWave. */
var NR_BANDS = [
	/* sub-1 GHz */
	['n71',617,652],['n29',717,728],['n12',729,746],['n85',728,746],
	['n28',758,803],['n14',758,768],['n20',791,821],['n26',859,894],
	['n5',869,894],['n18',860,875],['n8',925,960],
	/* L-band / 1.4-1.5 GHz (SDL; n76 & n51 share 1427-1432, n50 & n75 share 1432-1517) */
	['n76',1427,1432],['n51',1427,1432],['n50',1432,1517],['n75',1432,1517],
	['n74',1475,1518],
	/* 1.8-2.2 GHz */
	['n3',1805,1880],['n2',1930,1990],['n25',1930,1995],['n70',1995,2020],
	['n1',2110,2170],['n65',2110,2200],['n66',2110,2200],
	/* 2.3-2.7 GHz (n7 FDD DL 2620-2690 before the broader TDD n41/n90 2496-2690
	   so an ARFCN in the overlap resolves to the narrower band first) */
	['n30',2350,2360],['n40',2300,2400],['n53',2483.5,2495],['n38',2570,2620],
	['n7',2620,2690],['n41',2496,2690],['n90',2496,2690],
	/* 3.3-5 GHz */
	['n48',3550,3700],['n78',3300,3800],['n77',3300,4200],['n79',4400,5000],
	/* FR2 (mmWave) */
	['n258',24250,27500],['n257',26500,29500],['n261',27500,28350],
	['n260',37000,40000],['n259',39500,43500]
];

/* NR-ARFCN -> centre frequency (MHz), 3GPP TS 38.104 Table 5.4.2.1-1:
   FR1 low  (0..3 GHz):      F = 5 kHz  * N                       -> N/200
   FR1 mid  (3..24.25 GHz):  F = 3000 + 15 kHz * (N - 600000)     (n77/n78/n79!)
   FR2      (24.25..100 GHz):F = 24250.08 + 60 kHz * (N - 2016667) */
function nrArfcnToMhz(n) {
	if (n < 600000)   return n / 200;
	if (n < 2016667)  return 3000 + 0.015 * (n - 600000);
	return 24250.08 + 0.06 * (n - 2016667);
}

return baseclass.extend({
	LTE_BANDS: LTE_BANDS,
	NR_BANDS: NR_BANDS,

	/* EARFCN -> { band: 'B<n>', mhz: <number> } or null */
	lteEarfcn: function(earfcn) {
		for (var i = 0; i < LTE_BANDS.length; i++) {
			var b = LTE_BANDS[i];
			if (earfcn >= b[1] && earfcn <= b[2])
				return { band: 'B' + b[0], mhz: (b[3] + 0.1 * (earfcn - b[1])) };
		}
		return null;
	},

	/* NR-ARFCN -> { band: 'n<n>'|null, mhz: <number> } or null */
	nrArfcn: function(arfcn) {
		if (arfcn == null)
			return null;
		var mhz = nrArfcnToMhz(arfcn), band = null;
		for (var i = 0; i < NR_BANDS.length; i++)
			if (mhz >= NR_BANDS[i][1] && mhz <= NR_BANDS[i][2]) { band = NR_BANDS[i][0]; break; }
		return { band: band, mhz: mhz };
	}
});
