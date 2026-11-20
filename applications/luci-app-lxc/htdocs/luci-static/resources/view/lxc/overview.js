/*
 * Copyright (c) 2026. All Rights Reserved.
 * Paul Donald <newtwen+github@gmail.com>
 */

'use strict';
'require rpc';
'require form';
'require network';
'require uci';
'require tools.widgets as widgets';

return L.view.extend({
	load() {
		return Promise.all([

		]);
	},

	imagepanel() {

		window.img    = { 'red' : '🟥', 'green' : '🟩', 'blue' : '🟦' };
		window.states = { 'STOPPED' : 'red', 'RUNNING' : 'green', 'FROZEN' : 'blue' };

		const t_lxc_list  = document.getElementById('t_lxc_list');
		const loader_html = `<img src='${L.resource('icons/loading.svg')}' alt='loading' width='16' height='16' style='vertical-align:middle' />`;
		const output_list = document.getElementById('lxc-list-output');
		const output_add  = document.getElementById('lxc-add-output');
		const loader_add  = document.getElementById('lxc-add-loader');
		const div_create  = document.getElementById('div_create');
		const bt_create   = div_create.querySelector('#bt_create');

		bt_create.disabled = true;
		info_message(output_add, _('Template download in progress, please be patient!'));
		bt_create.addEventListener('click', lxc_create);

		function lxc_create() {
			const lxc_name     = div_create.querySelector('#tx_name').value.replace(/[\s!@#$%^&*()+=[\]{};':'\\|,<>/?]/g,'');
			const lxc_template = div_create.querySelector('#s_template').value;

			if (t_lxc_list.querySelector(`[data-id="${lxc_name}"]`) != null) {
				return info_message(output_add, _('Container with that name already exists!'), 2000);
			}

			bt_create.disabled = true;
			output_add.innerHTML = '';

			if (!lxc_template) {
				return set_no_template();
			}

			if (!lxc_name || !lxc_name.length) {
				bt_create.disabled = false;
				return info_message(output_add, _('The Name field must not be empty!'), 2000);
			}

			loading(loader_add);

			new window.XHR().get(`/cgi-bin/luci/admin/services/lxc/lxc_create/${lxc_name}/${lxc_template}`, null,
			function(x) {
				bt_create.disabled = false;
				loading(loader_add, 0);

				if (!x) {
					info_message(output_add, _('Container creation failed!'), 2000);
				}
			})
		}

		function lxc_create_template(lxc_name, lxc_state) {
			if (document.getElementById(lxc_name)) {
				return;
			}

			info_message(output_list, '');

			t_lxc_list.appendChild(E('div', {
				'class': 'tr cbi-section-table-row',
				'id': lxc_name,
				'data-id': lxc_name
			}, [
				E('div', { 'class': 'td', 'style': 'width:30%', 'data-id': lxc_name }, [
					E('strong', {}, [ lxc_name ])
				]),
				E('div', { 'class': 'td statusimg', 'style': 'width:20%' }, [
					window.img[lxc_state]
				]),
				E('div', { 'class': 'td', 'style': 'width:50%' }, [
					E('input', {
						'type': 'button',
						'class': 'cbi-button cbi-button-apply',
						'value': _('Start'),
						'data-action': 'start',
						'click': function(ev) { action_handler(ev.target) }
					}),
					'\u00a0',
					E('input', {
						'type': 'button',
						'class': 'cbi-button cbi-button-reset',
						'value': _('Stop'),
						'data-action': 'stop',
						'click': function(ev) { action_handler(ev.target) }
					}),
					'\u00a0',
					E('input', {
						'type': 'button',
						'class': 'cbi-button cbi-button-remove',
						'value': _('Delete'),
						'data-action': 'destroy',
						'click': function(ev) { action_handler(ev.target) }
					}),
					'\u00a0',
					E('select', {
						'class': 'cbi-input-select cbi-button',
						'style': 'width:10em',
						'change': function(ev) { action_more_handler(ev.target) }
					}, [
						E('option', { 'selected': 'selected', 'disabled': 'disabled' }, [ 'more' ]),
						E('option', {}, [ 'configure' ]),
						E('option', {}, [ 'freeze' ]),
						E('option', {}, [ 'unfreeze' ]),
						E('option', {}, [ 'reboot' ])
					]),
					E('span', {
						'data-loader': '',
						'style': 'display:inline-block; width:16px; height:16px; margin:0 5px'
					})
				])
			]));
		}

		function action_handler(self) {
			const bt_action  = self;
			const action     = self.dataset['action'];
			const lxc_name   = self.parentNode.parentNode.dataset['id'];
			const status_img = self.parentNode.parentNode.querySelector('.statusimg');
			const loader     = self.parentNode.querySelector('[data-loader]');

			bt_action.disabled = true;

			if (action == 'stop') {
				loading(loader);

				new window.XHR().get(L.url('admin/services/lxc/lxc_action/%h/%h'.format(action, lxc_name)), null,
				function(x, ec) {
					loading(loader, 0);
					bt_action.disabled = false;

					if (!x || ec) {
						return info_message(output_list, _('Action failed!'), 2000);
					}
					set_status(status_img, 'red');
				});
			}
			else if (action == 'start') {
				loading(loader);

				new window.XHR().get(L.url('admin/services/lxc/lxc_action/%h/%h'.format(action, lxc_name)), null,
				function(x, data) {
					loading(loader, 0);
					bt_action.disabled = false;

					if (!x || data) {
						return info_message(output_list, _('Action failed!'), 2000);
					}
					set_status(status_img, 'green');
				});
			}
			else if (action == 'destroy') {
				const div = self.parentNode.parentNode;
				const img = div.querySelector('.statusimg');;

				if (img.innerHTML != window.img['red']) {
					bt_action.disabled = false;
					return info_message(output_list, _('Container is still running!'), 2000);
				}

				if (!confirm(_('This will completely remove a stopped LXC container from disk. Are you sure?'))) {
					bt_action.disabled = false;
					return;
				}
				loading(loader);

				new window.XHR().get(L.url('admin/services/lxc/lxc_action/%h/%h'.format(action, lxc_name)), null,
				function(x, ec) {
					loading(loader, 0);
					bt_action.disabled = false;

					if (!x || ec) {
						return info_message(output_list, _('Action failed!'), 2000);
					}
					const div = self.parentNode.parentNode;
					div.parentNode.removeChild(div);
				});
			}
		}

		function lxc_configure_handler(self) {
			const div      = self.parentNode;
			const textarea = div.querySelector('[data-id]');
			const lxc_name = textarea.dataset['id'];
			const lxc_conf = textarea.value;

			new window.XHR().post(L.url('admin/services/lxc/lxc_configuration_set/' + lxc_name), {'lxc_conf': encodeURIComponent(lxc_conf)},
			function(x) {
				if (!x || x.responseText != '0') {
					return info_message(output_list, _('Action failed!'), 2000);
				}
				info_message(output_list, _('LXC configuration updated'), 2000);
				var rmdiv = div.parentNode;
				rmdiv.parentNode.removeChild(rmdiv);
			})
		}

		function lxc_configure_template(lxc_name, lxc_conf) {
			return E('div', {}, [
				E('textarea', {
					'data-id': lxc_name,
					'rows': '20',
					'style': 'width:600px;font-family:monospace;white-space:pre;overflow-wrap:normal;overflow-x:scroll;'
				}, [ lxc_conf ]),
				E('input', {
					'type': 'button',
					'class': 'cbi-button',
					'value': _('Confirm'),
					'click': function(ev) { lxc_configure_handler(ev.target) }
				})
			]);
		}

		function action_more_handler(self) {
			const lxc_name = self.parentNode.parentNode.dataset['id'];
			const loader   = self.parentNode.querySelector('[data-loader]');
			const option   = self.options[self.selectedIndex].text;
			self.value   = 'more';

			let img;

			const div0 = document.createElement('div');
			const div1 = self.parentNode.parentNode;
			const next_div = div1.nextSibling;

			switch(option) {
				case 'configure':
					if (next_div && next_div.dataset['action'] !== undefined) {
						div1.parentNode.removeChild(next_div);
					}

					new window.XHR().get(L.url('admin/services/lxc/lxc_configuration_get/' + lxc_name), null,
					function(x) {
						div0.appendChild(lxc_configure_template(lxc_name, x.responseText));
						div0.setAttribute('data-action','');
						div1.parentNode.insertBefore(div0, div1.nextSibling);
					})
				break;

				case 'freeze':
					img = self.parentNode.parentNode.querySelector('.statusimg');
					if(img.innerHTML != window.img['green']) {
						return info_message(output_list, _('Container is not running!'), 2000);
					}

					loading(loader);

					new window.XHR().get(L.url('admin/services/lxc/lxc_action/%h/%h'.format(option, lxc_name)), null,
					function(x, ec) {
						loading(loader, 0)
						if (!x || ec) {
							return info_message(output_list, _('Action failed!'), 2000);
						}
						set_status(img, 'blue');
					})
				break;

				case 'unfreeze':
					img = self.parentNode.parentNode.querySelector('.statusimg');
					if(img.innerHTML != window.img['blue']) {
						return info_message(output_list, _('Container is not frozen!'), 2000);
					}

					loading(loader);

					new window.XHR().get(L.url('admin/services/lxc/lxc_action/%h/%h'.format(option, lxc_name)), null,
					function(x, ec) {
						loading(loader, 0);
						if (!x || ec) {
							return info_message(output_list, _('Action failed!'), 2000);
						}
						set_status(img, 'green');
					})
				break;

				case 'reboot':
					img = self.parentNode.parentNode.querySelector('.statusimg');
					if(img.innerHTML != window.img['green']) {
						return info_message(output_list, _('Container is not running!'), 2000);
					}

					if (!confirm('Are you sure?')) {
						return;
					}

					loading(loader);

					new window.XHR().get(L.url('admin/services/lxc/lxc_action/%h/%h'.format(option, lxc_name)), null,
					function(x, ec) {
						loading(loader, 0)
						if (!x || ec) {
							return info_message(output_list, _('Action failed!'), 2000);
						}
						info_message(output_list, _('LXC container rebooted'), 2000);
					})
				break;
			}
		}

		function set_no_container() {
			info_message(output_list, _('There are no containers available yet.'));
		}

		function set_no_template() {
			bt_create.disabled = true;
			info_message(output_add, _('There are no templates for your architecture available.') + ' ' +
				_('Please select another containers URL.'));
		}

		function lxc_list_update() {
			window.XHR.poll(4, L.url('admin/services/lxc/lxc_action/list'), null,
			function(x, data) {
				if (!x || !data)
				{
					return;
				}

				const lxc_count = Object.keys(data).length;
				if (!lxc_count) {
					return set_no_container();
				}

				const lxcs = t_lxc_list.querySelectorAll('.td[data-id]');
				const lxc_name_div = {};
				for (let i = 0, len = lxcs.length; i < len; i++) {
					const lxc_name = lxcs[i].dataset['id'];
					if (!(lxc_name in data)) {
						const div = t_lxc_list.querySelector(`[data-id="${lxc_name}"]`).parentNode;
						div.parentNode.removeChild(div);
						continue;
					}
					lxc_name_div[lxc_name] = lxcs[i].parentNode.querySelector('.statusimg');
				}

				for(let key in data) {
					const lxc_name = key;
					const state = window.states[data[key]];

					if (!(lxc_name in lxc_name_div))
					{
						lxc_create_template(lxc_name, state);
					}
					else if (state != get_status(lxc_name_div[lxc_name]))
					{
						set_status(lxc_name_div[lxc_name], state);
					}
				}
			})
		}

		function loading(elem, state) {
			state = (typeof state === 'undefined') ? 1 : state;
			if (state === 1) {
				elem.innerHTML = loader_html;
			}
			else {
				setTimeout(function() { elem.innerHTML = ''}, 2000);
			}
		}

		function set_status(elem, state) {
			if (!elem || typeof elem.setAttribute !== 'function') {
				console.warn('set_status: invalid element for', state, elem);
				return;
			}

			state = (typeof state === 'undefined') ? 1 : state;
			setTimeout(function() { elem.innerHTML = window.img[state] }, 300);
		}

		function get_status(elem) {
			if (!elem || typeof elem.getAttribute !== 'function') {
				console.warn('get_status: invalid element', elem);
				return undefined;
			}
			const src = elem.innerHTML;
			for (let i in window.img) {
				if (window.img[i] == src) {
					return i;
				}
			}
			return undefined;
		}

		function info_message(output, msg, timeout) {
			timeout = timeout || 0;
			output.innerHTML = '<em>' + msg + '</em>';
			if (timeout > 0) {
				setTimeout(function(){ output.innerHTML=''}, timeout);
			}
		}

		new window.XHR().get(L.url('admin/services/lxc/lxc_get_downloadable'), null,
		function(x, data) {
			if (!x) return;

			if (!data) return set_no_template();


			var lxc_count = Object.keys(data).length;
			if (!lxc_count) return set_no_template();

			var select = document.getElementById('s_template');
			for(var key in data) {
				var option = document.createElement('option');
				option.value = data[key];
				option.text = data[key].replace(/[_:]/g, ' ');
				select.add(option, -1);
			}

			info_message(output_add, '');
			bt_create.disabled = false;
		})

		lxc_list_update();

	},

	/** @private */
	populateBasicOptions(s, tab) {
		let o;

		o = s.taboption(tab, form.Value, 'url', _('Containers URL'))
		o.value('images.linuxcontainers.org')
		o.value('repo.turris.cz/lxc', 'repo.turris.cz/lxc (SSL req.)')
		o.default = 'images.linuxcontainers.org'
		o.rmempty = false

		o = s.taboption(tab, form.Value, 'min_space', _('Free Space Threshold'),
			_('Minimum required free space for LXC Container creation in KB'))
		o.default = '100000'
		o.datatype = 'min(50000)'
		o.rmempty = false

		o = s.taboption(tab, form.Value, 'min_temp', _('Free Temp Threshold'),
			_('Minimum required free temp space for LXC Container creation in KB'))
		o.default = '100000'
		o.datatype = 'min(50000)'
		o.rmempty = false

	},

	/** @private */
	populateOptions(s) {

		s.tab('basic', _('Basic Settings'));
		this.populateBasicOptions(s, 'basic');

	},

	render() {
		let m, s;

		m = new form.Map('lxc', _('LXC Containers'),
			_('<b>Please note:</b> LXC Containers require features not available on OpenWrt images for devices with small flash.') + '<br /> ' +
			_("Also you may want to install 'kmod-veth' for optional network support."));

		s = m.section(form.TypedSection, 'lxc');
		s.addremove = false;
		s.anonymous = true;

		let lxc_list = E('div', {'class': 'cbi-section'}, [
			E('h3', {}, [_('Available Containers')]),
			E('div', {'class': 'cbi-section-node'}, [
				E('div', { 'class': 'table cbi-section-table', id: 't_lxc_list' }, [
					E('div', { 'class': 'tr cbi-section-table-titles' }, [
						E('div', { 'class': 'th cbi-section-table-cell' }, [ _('Name') ]),
						E('div', { 'class': 'th cbi-section-table-cell' }, [ _('Status') ]),
						E('div', { 'class': 'th cbi-section-table-cell' }, [ _('Actions') ]),
					])
				])
			])
		]);

		let lxc_output= E('div', { 'class': 'cbi-section' }, [
			E('span', { 'id': 'lxc-list-output' }, [

			])
		]);

		let create_new = E('div', {'class': 'cbi-section'}, [
			E('h3', {}, [_('Create New Container')]),
			E('div', {'class': 'cbi-section-node'}, [
				E('table', { 'class': 'table cbi-section-table', id: 't_lxc_create' }, [
					E('tr', { 'class': 'tr cbi-section-table-titles' }, [
						E('th', { 'class': 'th cbi-section-table-cell' }, [ _('Name') ]),
						E('th', { 'class': 'th cbi-section-table-cell' }, [ _('Status') ]),
						E('th', { 'class': 'th cbi-section-table-cell' }, [ _('Actions') ]),
					]),
					E('tr', { 'class': 'tr cbi-section-table-row', id: 'div_create' }, [
						E('td', { 'class': 'td cbi-section-table-titles' }, [ 
							E('input', { id: 'tx_name', 'class': 'cbi-input-text', type: 'text', placeholder: _('Enter new name') }),
						]),
						E('td', { }, [ 
							E('select', { id: 's_template', 'class': 'cbi-input-select cbi-button' }),
						]),
						E('td', { }, [ 
							E('button', { id: 'bt_create', 'class': 'cbi-button cbi-button-add', disabled: false }, [ _('Create') ]),
							E('span', { 'id': 'lxc-add-loader' }, [  ]),
						]),
					]),
				]),				
			])
		]);

		let create_output = E('span', { id: 'lxc-add-output' }, []);

		this.populateOptions(s);

		return m.render().then(node => {
			document.getElementById('tabmenu').append(node);
			document.getElementById('tabmenu').append(lxc_list);
			document.getElementById('tabmenu').append(lxc_output);
			document.getElementById('tabmenu').append(create_new);
			document.getElementById('tabmenu').append(create_output);
			this.imagepanel();
		});
	},
});
