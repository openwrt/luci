/*
 * iwinfo - Wireless Information Library - Lua Bindings
 *
 *   Copyright (C) 2009 Jo-Philipp Wich <xm@subsignal.org>
 *
 * The iwinfo library is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License version 2
 * as published by the Free Software Foundation.
 *
 * The iwinfo library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with the iwinfo library. If not, see http://www.gnu.org/licenses/.
 */

#include "iwinfo_lualib.h"


/*
 * ISO3166 country labels
 */

struct iwinfo_iso3166_label ISO3166_Names[] = {
	{ 0x3030 /* 00 */, "World" },
	{ 0x4144 /* AD */, "Andorra" },
	{ 0x4145 /* AE */, "United Arab Emirates" },
	{ 0x4146 /* AF */, "Afghanistan" },
	{ 0x4147 /* AG */, "Antigua and Barbuda" },
	{ 0x4149 /* AI */, "Anguilla" },
	{ 0x414C /* AL */, "Albania" },
	{ 0x414D /* AM */, "Armenia" },
	{ 0x414E /* AN */, "Netherlands Antilles" },
	{ 0x414F /* AO */, "Angola" },
	{ 0x4151 /* AQ */, "Antarctica" },
	{ 0x4152 /* AR */, "Argentina" },
	{ 0x4153 /* AS */, "American Samoa" },
	{ 0x4154 /* AT */, "Austria" },
	{ 0x4155 /* AU */, "Australia" },
	{ 0x4157 /* AW */, "Aruba" },
	{ 0x4158 /* AX */, "Aland Islands" },
	{ 0x415A /* AZ */, "Azerbaijan" },
	{ 0x4241 /* BA */, "Bosnia and Herzegovina" },
	{ 0x4242 /* BB */, "Barbados" },
	{ 0x4244 /* BD */, "Bangladesh" },
	{ 0x4245 /* BE */, "Belgium" },
	{ 0x4246 /* BF */, "Burkina Faso" },
	{ 0x4247 /* BG */, "Bulgaria" },
	{ 0x4248 /* BH */, "Bahrain" },
	{ 0x4249 /* BI */, "Burundi" },
	{ 0x424A /* BJ */, "Benin" },
	{ 0x424C /* BL */, "Saint Barthelemy" },
	{ 0x424D /* BM */, "Bermuda" },
	{ 0x424E /* BN */, "Brunei Darussalam" },
	{ 0x424F /* BO */, "Bolivia" },
	{ 0x4252 /* BR */, "Brazil" },
	{ 0x4253 /* BS */, "Bahamas" },
	{ 0x4254 /* BT */, "Bhutan" },
	{ 0x4256 /* BV */, "Bouvet Island" },
	{ 0x4257 /* BW */, "Botswana" },
	{ 0x4259 /* BY */, "Belarus" },
	{ 0x425A /* BZ */, "Belize" },
	{ 0x4341 /* CA */, "Canada" },
	{ 0x4343 /* CC */, "Cocos (Keeling) Islands" },
	{ 0x4344 /* CD */, "Congo" },
	{ 0x4346 /* CF */, "Central African Republic" },
	{ 0x4347 /* CG */, "Congo" },
	{ 0x4348 /* CH */, "Switzerland" },
	{ 0x4349 /* CI */, "Cote d'Ivoire" },
	{ 0x434B /* CK */, "Cook Islands" },
	{ 0x434C /* CL */, "Chile" },
	{ 0x434D /* CM */, "Cameroon" },
	{ 0x434E /* CN */, "China" },
	{ 0x434F /* CO */, "Colombia" },
	{ 0x4352 /* CR */, "Costa Rica" },
	{ 0x4355 /* CU */, "Cuba" },
	{ 0x4356 /* CV */, "Cape Verde" },
	{ 0x4358 /* CX */, "Christmas Island" },
	{ 0x4359 /* CY */, "Cyprus" },
	{ 0x435A /* CZ */, "Czech Republic" },
	{ 0x4445 /* DE */, "Germany" },
	{ 0x444A /* DJ */, "Djibouti" },
	{ 0x444B /* DK */, "Denmark" },
	{ 0x444D /* DM */, "Dominica" },
	{ 0x444F /* DO */, "Dominican Republic" },
	{ 0x445A /* DZ */, "Algeria" },
	{ 0x4543 /* EC */, "Ecuador" },
	{ 0x4545 /* EE */, "Estonia" },
	{ 0x4547 /* EG */, "Egypt" },
	{ 0x4548 /* EH */, "Western Sahara" },
	{ 0x4552 /* ER */, "Eritrea" },
	{ 0x4553 /* ES */, "Spain" },
	{ 0x4554 /* ET */, "Ethiopia" },
	{ 0x4649 /* FI */, "Finland" },
	{ 0x464A /* FJ */, "Fiji" },
	{ 0x464B /* FK */, "Falkland Islands" },
	{ 0x464D /* FM */, "Micronesia" },
	{ 0x464F /* FO */, "Faroe Islands" },
	{ 0x4652 /* FR */, "France" },
	{ 0x4741 /* GA */, "Gabon" },
	{ 0x4742 /* GB */, "United Kingdom" },
	{ 0x4744 /* GD */, "Grenada" },
	{ 0x4745 /* GE */, "Georgia" },
	{ 0x4746 /* GF */, "French Guiana" },
	{ 0x4747 /* GG */, "Guernsey" },
	{ 0x4748 /* GH */, "Ghana" },
	{ 0x4749 /* GI */, "Gibraltar" },
	{ 0x474C /* GL */, "Greenland" },
	{ 0x474D /* GM */, "Gambia" },
	{ 0x474E /* GN */, "Guinea" },
	{ 0x4750 /* GP */, "Guadeloupe" },
	{ 0x4751 /* GQ */, "Equatorial Guinea" },
	{ 0x4752 /* GR */, "Greece" },
	{ 0x4753 /* GS */, "South Georgia" },
	{ 0x4754 /* GT */, "Guatemala" },
	{ 0x4755 /* GU */, "Guam" },
	{ 0x4757 /* GW */, "Guinea-Bissau" },
	{ 0x4759 /* GY */, "Guyana" },
	{ 0x484B /* HK */, "Hong Kong" },
	{ 0x484D /* HM */, "Heard and McDonald Islands" },
	{ 0x484E /* HN */, "Honduras" },
	{ 0x4852 /* HR */, "Croatia" },
	{ 0x4854 /* HT */, "Haiti" },
	{ 0x4855 /* HU */, "Hungary" },
	{ 0x4944 /* ID */, "Indonesia" },
	{ 0x4945 /* IE */, "Ireland" },
	{ 0x494C /* IL */, "Israel" },
	{ 0x494D /* IM */, "Isle of Man" },
	{ 0x494E /* IN */, "India" },
	{ 0x494F /* IO */, "Chagos Islands" },
	{ 0x4951 /* IQ */, "Iraq" },
	{ 0x4952 /* IR */, "Iran" },
	{ 0x4953 /* IS */, "Iceland" },
	{ 0x4954 /* IT */, "Italy" },
	{ 0x4A45 /* JE */, "Jersey" },
	{ 0x4A4D /* JM */, "Jamaica" },
	{ 0x4A4F /* JO */, "Jordan" },
	{ 0x4A50 /* JP */, "Japan" },
	{ 0x4B45 /* KE */, "Kenya" },
	{ 0x4B47 /* KG */, "Kyrgyzstan" },
	{ 0x4B48 /* KH */, "Cambodia" },
	{ 0x4B49 /* KI */, "Kiribati" },
	{ 0x4B4D /* KM */, "Comoros" },
	{ 0x4B4E /* KN */, "Saint Kitts and Nevis" },
	{ 0x4B50 /* KP */, "North Korea" },
	{ 0x4B52 /* KR */, "South Korea" },
	{ 0x4B57 /* KW */, "Kuwait" },
	{ 0x4B59 /* KY */, "Cayman Islands" },
	{ 0x4B5A /* KZ */, "Kazakhstan" },
	{ 0x4C41 /* LA */, "Laos" },
	{ 0x4C42 /* LB */, "Lebanon" },
	{ 0x4C43 /* LC */, "Saint Lucia" },
	{ 0x4C49 /* LI */, "Liechtenstein" },
	{ 0x4C4B /* LK */, "Sri Lanka" },
	{ 0x4C52 /* LR */, "Liberia" },
	{ 0x4C53 /* LS */, "Lesotho" },
	{ 0x4C54 /* LT */, "Lithuania" },
	{ 0x4C55 /* LU */, "Luxembourg" },
	{ 0x4C56 /* LV */, "Latvia" },
	{ 0x4C59 /* LY */, "Libyan Arab Jamahiriya" },
	{ 0x4D41 /* MA */, "Morocco" },
	{ 0x4D43 /* MC */, "Monaco" },
	{ 0x4D44 /* MD */, "Moldova" },
	{ 0x4D45 /* ME */, "Montenegro" },
	{ 0x4D46 /* MF */, "Saint Martin (French part)" },
	{ 0x4D47 /* MG */, "Madagascar" },
	{ 0x4D48 /* MH */, "Marshall Islands" },
	{ 0x4D4B /* MK */, "Macedonia" },
	{ 0x4D4C /* ML */, "Mali" },
	{ 0x4D4D /* MM */, "Myanmar" },
	{ 0x4D4E /* MN */, "Mongolia" },
	{ 0x4D4F /* MO */, "Macao" },
	{ 0x4D50 /* MP */, "Northern Mariana Islands" },
	{ 0x4D51 /* MQ */, "Martinique" },
	{ 0x4D52 /* MR */, "Mauritania" },
	{ 0x4D53 /* MS */, "Montserrat" },
	{ 0x4D54 /* MT */, "Malta" },
	{ 0x4D55 /* MU */, "Mauritius" },
	{ 0x4D56 /* MV */, "Maldives" },
	{ 0x4D57 /* MW */, "Malawi" },
	{ 0x4D58 /* MX */, "Mexico" },
	{ 0x4D59 /* MY */, "Malaysia" },
	{ 0x4D5A /* MZ */, "Mozambique" },
	{ 0x4E41 /* NA */, "Namibia" },
	{ 0x4E43 /* NC */, "New Caledonia" },
	{ 0x4E45 /* NE */, "Niger" },
	{ 0x4E46 /* NF */, "Norfolk Island" },
	{ 0x4E47 /* NG */, "Nigeria" },
	{ 0x4E49 /* NI */, "Nicaragua" },
	{ 0x4E4C /* NL */, "Netherlands" },
	{ 0x4E4F /* NO */, "Norway" },
	{ 0x4E50 /* NP */, "Nepal" },
	{ 0x4E52 /* NR */, "Nauru" },
	{ 0x4E55 /* NU */, "Niue" },
	{ 0x4E5A /* NZ */, "New Zealand" },
	{ 0x4F4D /* OM */, "Oman" },
	{ 0x5041 /* PA */, "Panama" },
	{ 0x5045 /* PE */, "Peru" },
	{ 0x5046 /* PF */, "French Polynesia" },
	{ 0x5047 /* PG */, "Papua New Guinea" },
	{ 0x5048 /* PH */, "Philippines" },
	{ 0x504B /* PK */, "Pakistan" },
	{ 0x504C /* PL */, "Poland" },
	{ 0x504D /* PM */, "Saint Pierre and Miquelon" },
	{ 0x504E /* PN */, "Pitcairn" },
	{ 0x5052 /* PR */, "Puerto Rico" },
	{ 0x5053 /* PS */, "Palestinian Territory" },
	{ 0x5054 /* PT */, "Portugal" },
	{ 0x5057 /* PW */, "Palau" },
	{ 0x5059 /* PY */, "Paraguay" },
	{ 0x5141 /* QA */, "Qatar" },
	{ 0x5245 /* RE */, "Reunion" },
	{ 0x524F /* RO */, "Romania" },
	{ 0x5253 /* RS */, "Serbia" },
	{ 0x5255 /* RU */, "Russian Federation" },
	{ 0x5257 /* RW */, "Rwanda" },
	{ 0x5341 /* SA */, "Saudi Arabia" },
	{ 0x5342 /* SB */, "Solomon Islands" },
	{ 0x5343 /* SC */, "Seychelles" },
	{ 0x5344 /* SD */, "Sudan" },
	{ 0x5345 /* SE */, "Sweden" },
	{ 0x5347 /* SG */, "Singapore" },
	{ 0x5348 /* SH */, "St. Helena and Dependencies" },
	{ 0x5349 /* SI */, "Slovenia" },
	{ 0x534A /* SJ */, "Svalbard and Jan Mayen" },
	{ 0x534B /* SK */, "Slovakia" },
	{ 0x534C /* SL */, "Sierra Leone" },
	{ 0x534D /* SM */, "San Marino" },
	{ 0x534E /* SN */, "Senegal" },
	{ 0x534F /* SO */, "Somalia" },
	{ 0x5352 /* SR */, "Suriname" },
	{ 0x5354 /* ST */, "Sao Tome and Principe" },
	{ 0x5356 /* SV */, "El Salvador" },
	{ 0x5359 /* SY */, "Syrian Arab Republic" },
	{ 0x535A /* SZ */, "Swaziland" },
	{ 0x5443 /* TC */, "Turks and Caicos Islands" },
	{ 0x5444 /* TD */, "Chad" },
	{ 0x5446 /* TF */, "French Southern Territories" },
	{ 0x5447 /* TG */, "Togo" },
	{ 0x5448 /* TH */, "Thailand" },
	{ 0x544A /* TJ */, "Tajikistan" },
	{ 0x544B /* TK */, "Tokelau" },
	{ 0x544C /* TL */, "Timor-Leste" },
	{ 0x544D /* TM */, "Turkmenistan" },
	{ 0x544E /* TN */, "Tunisia" },
	{ 0x544F /* TO */, "Tonga" },
	{ 0x5452 /* TR */, "Turkey" },
	{ 0x5454 /* TT */, "Trinidad and Tobago" },
	{ 0x5456 /* TV */, "Tuvalu" },
	{ 0x5457 /* TW */, "Taiwan" },
	{ 0x545A /* TZ */, "Tanzania" },
	{ 0x5541 /* UA */, "Ukraine" },
	{ 0x5547 /* UG */, "Uganda" },
	{ 0x554D /* UM */, "U.S. Minor Outlying Islands" },
	{ 0x5553 /* US */, "United States" },
	{ 0x5559 /* UY */, "Uruguay" },
	{ 0x555A /* UZ */, "Uzbekistan" },
	{ 0x5641 /* VA */, "Vatican City State" },
	{ 0x5643 /* VC */, "St. Vincent and Grenadines" },
	{ 0x5645 /* VE */, "Venezuela" },
	{ 0x5647 /* VG */, "Virgin Islands, British" },
	{ 0x5649 /* VI */, "Virgin Islands, U.S." },
	{ 0x564E /* VN */, "Viet Nam" },
	{ 0x5655 /* VU */, "Vanuatu" },
	{ 0x5746 /* WF */, "Wallis and Futuna" },
	{ 0x5753 /* WS */, "Samoa" },
	{ 0x5945 /* YE */, "Yemen" },
	{ 0x5954 /* YT */, "Mayotte" },
	{ 0x5A41 /* ZA */, "South Africa" },
	{ 0x5A4D /* ZM */, "Zambia" },
	{ 0x5A57 /* ZW */, "Zimbabwe" },
	{ 0,               "" }
};



/* Determine type */
static int iwinfo_L_type(lua_State *L)
{
	const char *ifname = luaL_checkstring(L, 1);

#ifdef USE_NL80211
	if( nl80211_probe(ifname) )
		lua_pushstring(L, "nl80211");
	else
#endif

#ifdef USE_MADWIFI
	if( madwifi_probe(ifname) )
		lua_pushstring(L, "madwifi");
	else
#endif

#ifdef USE_WL
	if( wl_probe(ifname) )
		lua_pushstring(L, "wl");
	else
#endif

	if( wext_probe(ifname) )
		lua_pushstring(L, "wext");

	else
		lua_pushnil(L);

	return 1;
}

/* Shutdown backends */
static int iwinfo_L__gc(lua_State *L)
{
#ifdef USE_WL
	wl_close();
#endif
#ifdef USE_MADWIFI
	madwifi_close();
#endif
#ifdef USE_NL80211
	nl80211_close();
#endif
	wext_close();
}

/*
 * Build a short textual description of the crypto info
 */

static char * iwinfo_crypto_print_ciphers(int ciphers)
{
	static char str[128] = { 0 };
	char *pos = str;

	if( ciphers & IWINFO_CIPHER_WEP40 )
		pos += sprintf(pos, "WEP-40, ");

	if( ciphers & IWINFO_CIPHER_WEP104 )
		pos += sprintf(pos, "WEP-104, ");

	if( ciphers & IWINFO_CIPHER_TKIP )
		pos += sprintf(pos, "TKIP, ");

	if( ciphers & IWINFO_CIPHER_CCMP )
		pos += sprintf(pos, "CCMP, ");

	if( ciphers & IWINFO_CIPHER_WRAP )
		pos += sprintf(pos, "WRAP, ");

	if( ciphers & IWINFO_CIPHER_AESOCB )
		pos += sprintf(pos, "AES-OCB, ");

	if( ciphers & IWINFO_CIPHER_CKIP )
		pos += sprintf(pos, "CKIP, ");

	if( !ciphers || (ciphers & IWINFO_CIPHER_NONE) )
		pos += sprintf(pos, "NONE, ");

	*(pos - 2) = 0;

	return str;
}

static char * iwinfo_crypto_print_suites(int suites)
{
	static char str[64] = { 0 };
	char *pos = str;

	if( suites & IWINFO_KMGMT_PSK )
		pos += sprintf(pos, "PSK/");

	if( suites & IWINFO_KMGMT_8021x )
		pos += sprintf(pos, "802.1X/");

	if( !suites || (suites & IWINFO_KMGMT_NONE) )
		pos += sprintf(pos, "NONE/");

	*(pos - 1) = 0;

	return str;
}

static char * iwinfo_crypto_desc(struct iwinfo_crypto_entry *c)
{
	static char desc[512] = { 0 };

	if( c )
	{
		if( c->enabled )
		{
			/* WEP */
			if( c->auth_algs && !c->wpa_version )
			{
				if( (c->auth_algs & IWINFO_AUTH_OPEN) &&
				    (c->auth_algs & IWINFO_AUTH_SHARED) )
				{
					sprintf(desc, "WEP Open/Shared (%s)",
						iwinfo_crypto_print_ciphers(c->pair_ciphers));
				}
				else if( c->auth_algs & IWINFO_AUTH_OPEN )
				{
					sprintf(desc, "WEP Open System (%s)",
						iwinfo_crypto_print_ciphers(c->pair_ciphers));
				}
				else if( c->auth_algs & IWINFO_AUTH_SHARED )
				{
					sprintf(desc, "WEP Shared Auth (%s)",
						iwinfo_crypto_print_ciphers(c->pair_ciphers));
				}
			}

			/* WPA */
			else if( c->wpa_version )
			{
				switch(c->wpa_version) {
					case 3:
						sprintf(desc, "mixed WPA/WPA2 %s (%s)",
							iwinfo_crypto_print_suites(c->auth_suites),
							iwinfo_crypto_print_ciphers(c->pair_ciphers));
						break;

					case 2:
						sprintf(desc, "WPA2 %s (%s)",
							iwinfo_crypto_print_suites(c->auth_suites),
							iwinfo_crypto_print_ciphers(c->pair_ciphers));
						break;

					case 1:
						sprintf(desc, "WPA %s (%s)",
							iwinfo_crypto_print_suites(c->auth_suites),
							iwinfo_crypto_print_ciphers(c->pair_ciphers));
						break;
				}
			}
		}
		else
		{
			sprintf(desc, "None");
		}
	}
	else
	{
		sprintf(desc, "Unknown");
	}

	return desc;
}

/* Build Lua table from crypto data */
static void iwinfo_L_cryptotable(lua_State *L, struct iwinfo_crypto_entry *c)
{
	int i, j;

	lua_newtable(L);

	lua_pushboolean(L, c->enabled);
	lua_setfield(L, -2, "enabled");

	lua_pushstring(L, iwinfo_crypto_desc(c));
	lua_setfield(L, -2, "description");

	lua_pushboolean(L, (c->enabled && !c->wpa_version));
	lua_setfield(L, -2, "wep");

	lua_pushinteger(L, c->wpa_version);
	lua_setfield(L, -2, "wpa");

	lua_newtable(L);
	for( i = 0, j = 1; i < 8; i++ )
	{
		if( c->pair_ciphers & (1 << i) )
		{
			lua_pushstring(L, IWINFO_CIPHER_NAMES[i]);
			lua_rawseti(L, -2, j++);
		}
	}
	lua_setfield(L, -2, "pair_ciphers");

	lua_newtable(L);
	for( i = 0, j = 1; i < 8; i++ )
	{
		if( c->group_ciphers & (1 << i) )
		{
			lua_pushstring(L, IWINFO_CIPHER_NAMES[i]);
			lua_rawseti(L, -2, j++);
		}
	}
	lua_setfield(L, -2, "group_ciphers");

	lua_newtable(L);
	for( i = 0, j = 1; i < 8; i++ )
	{
		if( c->auth_suites & (1 << i) )
		{
			lua_pushstring(L, IWINFO_KMGMT_NAMES[i]);
			lua_rawseti(L, -2, j++);
		}
	}
	lua_setfield(L, -2, "auth_suites");

	lua_newtable(L);
	for( i = 0, j = 1; i < 8; i++ )
	{
		if( c->auth_algs & (1 << i) )
		{
			lua_pushstring(L, IWINFO_AUTH_NAMES[i]);
			lua_rawseti(L, -2, j++);
		}
	}
	lua_setfield(L, -2, "auth_algs");
}


/* Wrapper for assoclist */
static int iwinfo_L_assoclist(lua_State *L, int (*func)(const char *, char *, int *))
{
	int i, len;
	char rv[IWINFO_BUFSIZE];
	char macstr[18];
	const char *ifname = luaL_checkstring(L, 1);
	struct iwinfo_assoclist_entry *e;

	lua_newtable(L);
	memset(rv, 0, sizeof(rv));

	if( !(*func)(ifname, rv, &len) )
	{
		for( i = 0; i < len; i += sizeof(struct iwinfo_assoclist_entry) )
		{
			e = (struct iwinfo_assoclist_entry *) &rv[i];

			sprintf(macstr, "%02X:%02X:%02X:%02X:%02X:%02X",
				e->mac[0], e->mac[1], e->mac[2],
				e->mac[3], e->mac[4], e->mac[5]);

			lua_newtable(L);

			lua_pushnumber(L, e->signal);
			lua_setfield(L, -2, "signal");

			lua_pushnumber(L, e->noise);
			lua_setfield(L, -2, "noise");

			lua_setfield(L, -2, macstr);
		}
	}

	return 1;
}

/* Wrapper for tx power list */
static int iwinfo_L_txpwrlist(lua_State *L, int (*func)(const char *, char *, int *))
{
	int i, x, len;
	char rv[IWINFO_BUFSIZE];
	const char *ifname = luaL_checkstring(L, 1);
	struct iwinfo_txpwrlist_entry *e;

	lua_newtable(L);
	memset(rv, 0, sizeof(rv));

	if( !(*func)(ifname, rv, &len) )
	{
		for( i = 0, x = 1; i < len; i += sizeof(struct iwinfo_txpwrlist_entry), x++ )
		{
			e = (struct iwinfo_txpwrlist_entry *) &rv[i];

			lua_newtable(L);

			lua_pushnumber(L, e->mw);
			lua_setfield(L, -2, "mw");

			lua_pushnumber(L, e->dbm);
			lua_setfield(L, -2, "dbm");

			lua_rawseti(L, -2, x);
		}
	}

	return 1;
}

/* Wrapper for scan list */
static int iwinfo_L_scanlist(lua_State *L, int (*func)(const char *, char *, int *))
{
	int i, x, len;
	char rv[IWINFO_BUFSIZE];
	char macstr[18];
	const char *ifname = luaL_checkstring(L, 1);
	struct iwinfo_scanlist_entry *e;

	lua_newtable(L);
	memset(rv, 0, sizeof(rv));

	if( !(*func)(ifname, rv, &len) )
	{
		for( i = 0, x = 1; i < len; i += sizeof(struct iwinfo_scanlist_entry), x++ )
		{
			e = (struct iwinfo_scanlist_entry *) &rv[i];

			lua_newtable(L);

			/* BSSID */
			sprintf(macstr, "%02X:%02X:%02X:%02X:%02X:%02X",
				e->mac[0], e->mac[1], e->mac[2],
				e->mac[3], e->mac[4], e->mac[5]);

			lua_pushstring(L, macstr);
			lua_setfield(L, -2, "bssid");

			/* ESSID */
			if( e->ssid[0] )
			{
				lua_pushstring(L, (char *) e->ssid);
				lua_setfield(L, -2, "ssid");
			}

			/* Channel */
			lua_pushinteger(L, e->channel);
			lua_setfield(L, -2, "channel");

			/* Mode */
			lua_pushstring(L, (char *) e->mode);
			lua_setfield(L, -2, "mode");

			/* Quality, Signal */
			lua_pushinteger(L, e->quality);
			lua_setfield(L, -2, "quality");

			lua_pushinteger(L, e->quality_max);
			lua_setfield(L, -2, "quality_max");

			lua_pushnumber(L, (e->signal - 0x100));
			lua_setfield(L, -2, "signal");

			/* Crypto */
			iwinfo_L_cryptotable(L, &e->crypto);
			lua_setfield(L, -2, "encryption");

			lua_rawseti(L, -2, x);
		}
	}

	return 1;
}

/* Wrapper for frequency list */
static int iwinfo_L_freqlist(lua_State *L, int (*func)(const char *, char *, int *))
{
	int i, x, len;
	char rv[IWINFO_BUFSIZE];
	const char *ifname = luaL_checkstring(L, 1);
	struct iwinfo_freqlist_entry *e;

	lua_newtable(L);
	memset(rv, 0, sizeof(rv));

	if( !(*func)(ifname, rv, &len) )
	{
		for( i = 0, x = 1; i < len; i += sizeof(struct iwinfo_freqlist_entry), x++ )
		{
			e = (struct iwinfo_freqlist_entry *) &rv[i];

			lua_newtable(L);

			/* MHz */
			lua_pushinteger(L, e->mhz);
			lua_setfield(L, -2, "mhz");

			/* Channel */
			lua_pushinteger(L, e->channel);
			lua_setfield(L, -2, "channel");

			lua_rawseti(L, -2, x);
		}
	}

	return 1;
}

/* Wrapper for crypto settings */
static int iwinfo_L_encryption(lua_State *L, int (*func)(const char *, char *))
{
	const char *ifname = luaL_checkstring(L, 1);
	struct iwinfo_crypto_entry c = { 0 };

	if( !(*func)(ifname, (char *)&c) )
	{
		iwinfo_L_cryptotable(L, &c);
		return 1;
	}

	return 0;
}

/* Wrapper for country list */
static char * iwinfo_L_country_lookup(char *buf, int len, int iso3166)
{
	int i;
	struct iwinfo_country_entry *c;

	for( i = 0; i < len; i += sizeof(struct iwinfo_country_entry) )
	{
		c = (struct iwinfo_country_entry *) &buf[i];

		if( c->iso3166 == iso3166 )
			return c->ccode;
	}

	return NULL;
}

static int iwinfo_L_countrylist(lua_State *L, int (*func)(const char *, char *, int *))
{
	int len, i, j;
	char rv[IWINFO_BUFSIZE], alpha2[3];
	char *ccode;
	const char *ifname = luaL_checkstring(L, 1);
	struct iwinfo_iso3166_label *l;

	lua_newtable(L);
	memset(rv, 0, sizeof(rv));

	if( !(*func)(ifname, rv, &len) )
	{
		for( l = ISO3166_Names, j = 1; l->iso3166; l++ )
		{
			if( (ccode = iwinfo_L_country_lookup(rv, len, l->iso3166)) != NULL )
			{
				sprintf(alpha2, "%c%c",
					(l->iso3166 / 256), (l->iso3166 % 256));

				lua_newtable(L);

				lua_pushstring(L, alpha2);
				lua_setfield(L, -2, "alpha2");

				lua_pushstring(L, ccode);
				lua_setfield(L, -2, "ccode");

				lua_pushstring(L, l->name);
				lua_setfield(L, -2, "name");

				lua_rawseti(L, -2, j++);
			}
		}
	}

	return 1;
}


#ifdef USE_WL
/* Broadcom */
LUA_WRAP_INT(wl,channel)
LUA_WRAP_INT(wl,frequency)
LUA_WRAP_INT(wl,txpower)
LUA_WRAP_INT(wl,bitrate)
LUA_WRAP_INT(wl,signal)
LUA_WRAP_INT(wl,noise)
LUA_WRAP_INT(wl,quality)
LUA_WRAP_INT(wl,quality_max)
LUA_WRAP_INT(wl,mbssid_support)
LUA_WRAP_STRING(wl,mode)
LUA_WRAP_STRING(wl,ssid)
LUA_WRAP_STRING(wl,bssid)
LUA_WRAP_STRING(wl,country)
LUA_WRAP_LIST(wl,assoclist)
LUA_WRAP_LIST(wl,txpwrlist)
LUA_WRAP_LIST(wl,scanlist)
LUA_WRAP_LIST(wl,freqlist)
LUA_WRAP_LIST(wl,countrylist)
LUA_WRAP_LIST(wl,encryption)
#endif

#ifdef USE_MADWIFI
/* Madwifi */
LUA_WRAP_INT(madwifi,channel)
LUA_WRAP_INT(madwifi,frequency)
LUA_WRAP_INT(madwifi,txpower)
LUA_WRAP_INT(madwifi,bitrate)
LUA_WRAP_INT(madwifi,signal)
LUA_WRAP_INT(madwifi,noise)
LUA_WRAP_INT(madwifi,quality)
LUA_WRAP_INT(madwifi,quality_max)
LUA_WRAP_INT(madwifi,mbssid_support)
LUA_WRAP_STRING(madwifi,mode)
LUA_WRAP_STRING(madwifi,ssid)
LUA_WRAP_STRING(madwifi,bssid)
LUA_WRAP_STRING(madwifi,country)
LUA_WRAP_LIST(madwifi,assoclist)
LUA_WRAP_LIST(madwifi,txpwrlist)
LUA_WRAP_LIST(madwifi,scanlist)
LUA_WRAP_LIST(madwifi,freqlist)
LUA_WRAP_LIST(madwifi,countrylist)
LUA_WRAP_LIST(madwifi,encryption)
#endif

#ifdef USE_NL80211
/* NL80211 */
LUA_WRAP_INT(nl80211,channel)
LUA_WRAP_INT(nl80211,frequency)
LUA_WRAP_INT(nl80211,txpower)
LUA_WRAP_INT(nl80211,bitrate)
LUA_WRAP_INT(nl80211,signal)
LUA_WRAP_INT(nl80211,noise)
LUA_WRAP_INT(nl80211,quality)
LUA_WRAP_INT(nl80211,quality_max)
LUA_WRAP_INT(nl80211,mbssid_support)
LUA_WRAP_STRING(nl80211,mode)
LUA_WRAP_STRING(nl80211,ssid)
LUA_WRAP_STRING(nl80211,bssid)
LUA_WRAP_STRING(nl80211,country)
LUA_WRAP_LIST(nl80211,assoclist)
LUA_WRAP_LIST(nl80211,txpwrlist)
LUA_WRAP_LIST(nl80211,scanlist)
LUA_WRAP_LIST(nl80211,freqlist)
LUA_WRAP_LIST(nl80211,countrylist)
LUA_WRAP_LIST(nl80211,encryption)
#endif

/* Wext */
LUA_WRAP_INT(wext,channel)
LUA_WRAP_INT(wext,frequency)
LUA_WRAP_INT(wext,txpower)
LUA_WRAP_INT(wext,bitrate)
LUA_WRAP_INT(wext,signal)
LUA_WRAP_INT(wext,noise)
LUA_WRAP_INT(wext,quality)
LUA_WRAP_INT(wext,quality_max)
LUA_WRAP_INT(wext,mbssid_support)
LUA_WRAP_STRING(wext,mode)
LUA_WRAP_STRING(wext,ssid)
LUA_WRAP_STRING(wext,bssid)
LUA_WRAP_STRING(wext,country)
LUA_WRAP_LIST(wext,assoclist)
LUA_WRAP_LIST(wext,txpwrlist)
LUA_WRAP_LIST(wext,scanlist)
LUA_WRAP_LIST(wext,freqlist)
LUA_WRAP_LIST(wext,countrylist)
LUA_WRAP_LIST(wext,encryption)

#ifdef USE_WL
/* Broadcom table */
static const luaL_reg R_wl[] = {
	LUA_REG(wl,channel),
	LUA_REG(wl,frequency),
	LUA_REG(wl,txpower),
	LUA_REG(wl,bitrate),
	LUA_REG(wl,signal),
	LUA_REG(wl,noise),
	LUA_REG(wl,quality),
	LUA_REG(wl,quality_max),
	LUA_REG(wl,mode),
	LUA_REG(wl,ssid),
	LUA_REG(wl,bssid),
	LUA_REG(wl,country),
	LUA_REG(wl,assoclist),
	LUA_REG(wl,txpwrlist),
	LUA_REG(wl,scanlist),
	LUA_REG(wl,freqlist),
	LUA_REG(wl,countrylist),
	LUA_REG(wl,encryption),
	LUA_REG(wl,mbssid_support),
	{ NULL, NULL }
};
#endif

#ifdef USE_MADWIFI
/* Madwifi table */
static const luaL_reg R_madwifi[] = {
	LUA_REG(madwifi,channel),
	LUA_REG(madwifi,frequency),
	LUA_REG(madwifi,txpower),
	LUA_REG(madwifi,bitrate),
	LUA_REG(madwifi,signal),
	LUA_REG(madwifi,noise),
	LUA_REG(madwifi,quality),
	LUA_REG(madwifi,quality_max),
	LUA_REG(madwifi,mode),
	LUA_REG(madwifi,ssid),
	LUA_REG(madwifi,bssid),
	LUA_REG(madwifi,country),
	LUA_REG(madwifi,assoclist),
	LUA_REG(madwifi,txpwrlist),
	LUA_REG(madwifi,scanlist),
	LUA_REG(madwifi,freqlist),
	LUA_REG(madwifi,countrylist),
	LUA_REG(madwifi,encryption),
	LUA_REG(madwifi,mbssid_support),
	{ NULL, NULL }
};
#endif

#ifdef USE_NL80211
/* NL80211 table */
static const luaL_reg R_nl80211[] = {
	LUA_REG(nl80211,channel),
	LUA_REG(nl80211,frequency),
	LUA_REG(nl80211,txpower),
	LUA_REG(nl80211,bitrate),
	LUA_REG(nl80211,signal),
	LUA_REG(nl80211,noise),
	LUA_REG(nl80211,quality),
	LUA_REG(nl80211,quality_max),
	LUA_REG(nl80211,mode),
	LUA_REG(nl80211,ssid),
	LUA_REG(nl80211,bssid),
	LUA_REG(nl80211,country),
	LUA_REG(nl80211,assoclist),
	LUA_REG(nl80211,txpwrlist),
	LUA_REG(nl80211,scanlist),
	LUA_REG(nl80211,freqlist),
	LUA_REG(nl80211,countrylist),
	LUA_REG(nl80211,encryption),
	LUA_REG(nl80211,mbssid_support),
	{ NULL, NULL }
};
#endif

/* Wext table */
static const luaL_reg R_wext[] = {
	LUA_REG(wext,channel),
	LUA_REG(wext,frequency),
	LUA_REG(wext,txpower),
	LUA_REG(wext,bitrate),
	LUA_REG(wext,signal),
	LUA_REG(wext,noise),
	LUA_REG(wext,quality),
	LUA_REG(wext,quality_max),
	LUA_REG(wext,mode),
	LUA_REG(wext,ssid),
	LUA_REG(wext,bssid),
	LUA_REG(wext,country),
	LUA_REG(wext,assoclist),
	LUA_REG(wext,txpwrlist),
	LUA_REG(wext,scanlist),
	LUA_REG(wext,freqlist),
	LUA_REG(wext,countrylist),
	LUA_REG(wext,encryption),
	LUA_REG(wext,mbssid_support),
	{ NULL, NULL }
};

/* Common */
static const luaL_reg R_common[] = {
	{ "type", iwinfo_L_type },
	{ "__gc", iwinfo_L__gc  },
	{ NULL, NULL }
};


LUALIB_API int luaopen_iwinfo(lua_State *L) {
	luaL_register(L, IWINFO_META, R_common);

#ifdef USE_WL
	luaL_newmetatable(L, IWINFO_WL_META);
	luaL_register(L, NULL, R_wl);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setfield(L, -2, "wl");
#endif

#ifdef USE_MADWIFI
	luaL_newmetatable(L, IWINFO_MADWIFI_META);
	luaL_register(L, NULL, R_madwifi);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setfield(L, -2, "madwifi");
#endif

#ifdef USE_NL80211
	luaL_newmetatable(L, IWINFO_NL80211_META);
	luaL_register(L, NULL, R_nl80211);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setfield(L, -2, "nl80211");
#endif

	luaL_newmetatable(L, IWINFO_WEXT_META);
	luaL_register(L, NULL, R_wext);
	lua_pushvalue(L, -1);
	lua_setfield(L, -2, "__index");
	lua_setfield(L, -2, "wext");

	return 1;
}
