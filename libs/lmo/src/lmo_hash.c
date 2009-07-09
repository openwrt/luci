/*
 * Hash function from http://www.azillionmonkeys.com/qed/hash.html
 * Copyright (C) 2004-2008 by Paul Hsieh
 */

#include "lmo.h"

uint32_t sfh_hash(const char * data, int len)
{
	uint32_t hash = len, tmp;
	int rem;

	if (len <= 0 || data == NULL) return 0;

	rem = len & 3;
	len >>= 2;

	/* Main loop */
	for (;len > 0; len--) {
		hash  += sfh_get16(data);
		tmp    = (sfh_get16(data+2) << 11) ^ hash;
		hash   = (hash << 16) ^ tmp;
		data  += 2*sizeof(uint16_t);
		hash  += hash >> 11;
	}

	/* Handle end cases */
	switch (rem) {
		case 3: hash += sfh_get16(data);
			hash ^= hash << 16;
			hash ^= data[sizeof(uint16_t)] << 18;
			hash += hash >> 11;
			break;
		case 2: hash += sfh_get16(data);
			hash ^= hash << 11;
			hash += hash >> 17;
			break;
		case 1: hash += *data;
			hash ^= hash << 10;
			hash += hash >> 1;
	}

	/* Force "avalanching" of final 127 bits */
	hash ^= hash << 3;
	hash += hash >> 5;
	hash ^= hash << 4;
	hash += hash >> 17;
	hash ^= hash << 25;
	hash += hash >> 6;

	return hash;
}

