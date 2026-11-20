'use strict';
'require view';
'require fs';

return view.extend({
	setElementShown: function(selector, shown) {
		var loaderE = document.querySelector(selector);
		if (loaderE) {
			if (loaderE.classList.contains('hidden') === shown)
			{
				if (shown) {
					loaderE.classList.remove('hidden');
				} else {
					loaderE.classList.add('hidden');
				}
			}
		}
	},
	fixupResponse: function(response) {
		return response.toString().replace(/(\n$)/, '');
	},
	rpcDownloadAccountLists: function() {
		return new Promise(L.bind(function (resolve, fail) {
			fs.exec_direct('/usr/libexec/vpncmd-call', [ 'account-list' ])
				.then(L.bind(function(resp) {
					var accounts = [];
					var responseList = this.fixupResponse(resp).split('\n');
					responseList.forEach(function(d) {
						var s = d.split(',');
						var tmp = {};
						tmp.name = s[0];
						tmp.properties = {};
						tmp.properties['Status'] = s[1];
						tmp.properties['Remote'] = s[2];
						tmp.properties['Hub'] = s[3];
						accounts.push(tmp);
					})
					resolve(accounts);
				},this));
		},this));
	},
	rpcDownloadAccountStatus: function(account) {
		return new Promise(L.bind(function (resolve, fail) {
			fs.exec_direct('/usr/libexec/vpncmd-call', [ 'account-status-get', account.name ])
				.then(L.bind(function(resp) {
					var detailList = this.fixupResponse(resp).split('\n');
					detailList.forEach(function(d) {
						var s = d.split(',');
						if (s.length === 2)
							account.properties[s[0]] = s[1];
					});
					resolve(account);
				},this));
		},this));
	},
	downloadAllStatus: function(accountList) {
		var promises = [];
		accountList.forEach(L.bind(function(account) { promises.push(this.rpcDownloadAccountStatus(account)); },this));
		return Promise.all(promises);
	},
	downloadAllAccounts: function() {
		return new Promise(L.bind(function(resolve) {
			this.rpcDownloadAccountLists().then(L.bind(function(accountList) {
				this.downloadAllStatus(accountList).then(function(accountListWDetail) { 
					resolve(accountListWDetail); 
				});
			},this));
		},this));
	},
	updateAccountTable: function(listData) {
		var tableSelector = '#accountTable';
		var table = isElem(tableSelector) ? tableSelector : document.querySelector(tableSelector);
		if (listData.length > 0 ) {
			listData.forEach(L.bind(function(account) { 
				table.appendChild(this.renderAccountRow(account)); 
			},this));
		} else {
			this.setElementShown('#emptyLabel', true);
		}
		this.setElementShown('#loader', false);
	},
	renderAccountRow: function(account) {
		var properties = [];
		for(var key in account.properties) {
			if (account.properties.hasOwnProperty(key)) {
				properties.push(E('strong', {}, [key + ':']));
				properties.push(account.properties[key]);
				properties.push(E('br', {}, []));
			}
		}
		var row = E('div', {'class':'tr cbi-section-table-row'}, [
					E('div', {'class':'td', 'style': 'width: 20%;vertical-align:top;'}, [
						E('strong', {}, ['Account:']),
						account.name
					]),
					E('div', {'class':'td'}, properties)
				]);
		return row;
	},
	render: function() {
		var view = E([], [
			E('h2', {}, _('SoftEther Status')),
			E('div', { 'class': 'cbi-section'}, [
				E('div', { 'class': 'cbi-section-node'}, [
					E('div', { 'id': 'accountTable', 'class': 'table cbi-section-table' }, [	])
				])
			]),
			E('div', { 'id': 'loader', 'class': 'spinning' }, _('Loading account information…')),
			E('div', { 'id': 'emptyLabel', 'class': 'hidden'}, _('No VPN account configured.'))
		]);
		this.downloadAllAccounts().then(L.bind(function(v) { this.updateAccountTable(v); },this));
		return view;
	},
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
});
