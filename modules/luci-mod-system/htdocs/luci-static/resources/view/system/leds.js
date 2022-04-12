'use strict';
'require view';
'require uci';
'require rpc';
'require form';
'require fs';

var callLeds = rpc.declare({
	object: 'luci',
	method: 'getLEDs',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			callLeds(),
			L.resolveDefault(fs.list('/www' + L.resource('view/system/led-trigger')), [])
		]).then(function(data) {
			var plugins = data[1];
			var tasks = [];

			for (var i = 0; i < plugins.length; i++) {
				var m = plugins[i].name.match(/^(.+)\.js$/);

				if (plugins[i].type != 'file' || m == null)
					continue;

				tasks.push(L.require('view.system.led-trigger.' + m[1]).then(L.bind(function(name){
					return L.resolveDefault(L.require('view.system.led-trigger.' + name)).then(function(form) {
						return {
							name: name,
							form: form,
						};
					});
				}, this, m[1])));
			}

			return Promise.all(tasks).then(function(plugins) {
				var value = {};
				value[0] = data[0];
				value[1] = plugins;
				return value;
			});
		});
	},

	render: function(data) {
		var m, s, o, triggers = [];
		var leds = data[0];
		var plugins = data[1];

		for (var k in leds)
			for (var i = 0; i < leds[k].triggers.length; i++)
				triggers[i] = leds[k].triggers[i];

		m = new form.Map('system',
			_('<abbr title="Light Emitting Diode">LED</abbr> Configuration'),
			_('Customizes the behaviour of the device <abbr title="Light Emitting Diode">LED</abbr>s if possible.'));

		s = m.section(form.GridSection, 'led', '');
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.addbtntitle = _('Add LED action');
		s.nodescriptions = true;

		s.option(form.Value, 'name', _('Name'));

		o = s.option(form.ListValue, 'sysfs', _('<abbr title="Light Emitting Diode">LED</abbr> Name'));
		Object.keys(leds).sort().forEach(function(name) {
			o.value(name)
		});

		o = s.option(form.ListValue, 'trigger', _('Trigger'));
		for (var i = 0; i < plugins.length; i++) {
			var plugin = plugins[i];

			if ( plugin.form.kernel == false ) {
				o.value(plugin.name, plugin.form.trigger);
			}
			else {
				if (triggers.indexOf(plugin.name) >= 0)
					o.value(plugin.name, plugin.form.trigger);
			}
		}
		o.onchange = function(ev, section, value) {
			for (var i = 0; i < plugins.length; i++) {
				var plugin = plugins[i];
				if ( plugin.name === value )
					this.map.findElement('id', 'cbid.system.%s.trigger'.format(section))
						.nextElementSibling.innerHTML = plugin.form.description || '';
			}
		}
		o.load = function(section_id) {
			var trigger = uci.get('system', section_id, 'trigger');
			for (var i = 0; i < plugins.length; i++) {
				var plugin = plugins[i];
				if ( plugin.name === trigger)
					this.description = plugin.form.description || ' ';
			}
			return trigger;
		};

		s.addModalOptions = function(s) {
			for (var i = 0; i < plugins.length; i++) {
				var plugin = plugins[i];
				plugin.form.addFormOptions(s);
			}

			var opts = s.getOption();

			var removeIfNoneActive = function(original_remove_fn, section_id) {
				var isAnyActive = false;

				for (var optname in opts) {
					if (opts[optname].ucioption != this.ucioption)
						continue;

					if (!opts[optname].isActive(section_id))
						continue;

					isAnyActive = true;
					break;
				}

				if (!isAnyActive)
					original_remove_fn.call(this, section_id);
			};

			for (var optname in opts) {
				if (!opts[optname].ucioption || optname == opts[optname].ucioption)
					continue;
				opts[optname].remove = removeIfNoneActive.bind(opts[optname], opts[optname].remove);
			}
		};

		return m.render();
	}
});
