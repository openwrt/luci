'use strict';
'require baseclass';

return baseclass.extend({

	_encryptionAlgorithms: new Map([
		['3des', true],
		['cast128', true],
		['blowfish128', true],
		['blowfish192', true],
		['blowfish256', true],
		['null', true],
		['aes128'],
		['aes192'],
		['aes256'],
		['aes128ctr'],
		['aes192ctr'],
		['aes256ctr'],
		['camellia128'],
		['camellia192'],
		['camellia256'],
		['camellia128ctr'],
		['camellia192ctr'],
		['camellia256ctr']
	]),

	_authenticatedEncryptionAlgorithms: new Map([
		['aes128ccm64'],
		['aes192ccm64'],
		['aes256ccm64'],
		['aes128ccm96'],
		['aes192ccm96'],
		['aes256ccm96'],
		['aes128ccm128'],
		['aes192ccm128'],
		['aes256ccm128'],
		['aes128gcm64'],
		['aes192gcm64'],
		['aes256gcm64'],
		['aes128gcm96'],
		['aes192gcm96'],
		['aes256gcm96'],
		['aes128gcm128'],
		['aes192gcm128'],
		['aes256gcm128'],
		['aes128gmac'],
		['aes192gmac'],
		['aes256gmac'],
		['camellia128ccm64'],
		['camellia192ccm64'],
		['camellia256ccm64'],
		['camellia128ccm96'],
		['camellia192ccm96'],
		['camellia256ccm96'],
		['camellia128ccm128'],
		['camellia192ccm128'],
		['camellia256ccm128'],
		['chacha20poly1305']
	]),

	_hashAlgorithms: new Map([
		['md5', true],
		['md5_128', true],
		['sha1', true],
		['sha1_160', true],
		['aesxcbc'],
		['aescmac'],
		['aes128gmac'],
		['aes192gmac'],
		['aes256gmac'],
		['sha256'],
		['sha384'],
		['sha512'],
		['sha256_96']
	]),

	_dhAlgorithms: new Map([
		['modp768', true],
		['modp1024', true],
		['modp1536', true],
		['modp2048'],
		['modp3072'],
		['modp4096'],
		['modp6144'],
		['modp8192'],
		['modp1024s160', true],
		['modp2048s224', true],
		['modp2048s256', true],
		['ecp192', true],
		['ecp224'],
		['ecp256'],
		['ecp384'],
		['ecp521'],
		['ecp224bp'],
		['ecp256bp'],
		['ecp384bp'],
		['ecp512bp'],
		['curve25519'],
		['curve448']
	]),

	_prfAlgorithms: new Map([
		['prfmd5', true],
		['prfsha1', true],
		['prfaesxcbc'],
		['prfaescmac'],
		['prfsha256'],
		['prfsha384'],
		['prfsha512']
	]),

	_getAlgorithmNames: function (algorithms) {
		return Array.from(algorithms.keys());
	},

	isInsecure: function (algorithmName) {
		return this._encryptionAlgorithms.get(algorithmName) == true
			|| this._authenticatedEncryptionAlgorithms.get(algorithmName) == true
			|| this._hashAlgorithms.get(algorithmName) == true
			|| this._dhAlgorithms.get(algorithmName) == true
			|| this._prfAlgorithms.get(algorithmName) == true;
	},

	getEncryptionAlgorithms: function () {
		return this._getAlgorithmNames(this._encryptionAlgorithms);
	},

	getAuthenticatedEncryptionAlgorithms: function () {
		return this._getAlgorithmNames(this._authenticatedEncryptionAlgorithms);
	},

	getHashAlgorithms: function () {
		return this._getAlgorithmNames(this._hashAlgorithms);
	},

	getDiffieHellmanAlgorithms: function () {
		return this._getAlgorithmNames(this._dhAlgorithms);
	},

	getPrfAlgorithms: function () {
		return this._getAlgorithmNames(this._prfAlgorithms);
	}
});
