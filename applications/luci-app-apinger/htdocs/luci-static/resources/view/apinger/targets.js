'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load() {
		return Promise.all([
			uci.load('apinger'),
		])
	},

	render() {
		let m, s, o;

		const a_ifaces = uci.sections('apinger', 'interface');
		const a_down = uci.sections('apinger', 'alarm_down');
		const a_delay = uci.sections('apinger', 'alarm_delay');
		const a_loss = uci.sections('apinger', 'alarm_loss');

		m = new form.Map('apinger', _('Apinger - Targets'),
			_('Interface: Interface to use to track target') + '<br />' +
			_('Address: Target address to be tracked') + '<br />' +
			_('Ping Interval: How often the probe should be sent') + '<br />' +
			_('Average Delay: How many replies should be used to compute average delay') + '<br />' +
			_('Average Loss: How many probes should be used to compute average loss') + '<br />' +
			_('Average Delay and Loss: The delay (in samples) after which loss is computed, without this delays larger than interval would be treated as loss') +
			'<br />');

		s = m.section(form.GridSection, 'target');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add Target');

		o = s.option(form.ListValue, 'interface', _('Interface'));
		for (let aif of a_ifaces) {
			o.value(aif['.name']);
		}

		o = s.option(form.Value, 'address', _('Address'));
		o.datatype = 'ip4addr';

		o = s.option(form.Value, 'probe_interval', _('Ping Interval'));
		o.datatype = 'integer';

		o= s.option(form.Value, 'avg_delay_samples', _('Average Delay'));
		o.datatype = 'integer';

		o = s.option(form.Value, 'avg_loss_samples', _('Average Loss'));
		o.datatype = 'integer';

		o = s.option(form.Value, 'avg_loss_delay_samples', _('Average Loss/Delay'));
		o.datatype = 'integer';

		o = s.option(form.Flag, 'rrd', _('Generate RRD Graphs'));
		o.datatype = 'boolean';
		o.default = false;

		o = s.option(form.ListValue, 'alarm_down', _('Down Alarm'));
		for (let ad of a_down) {
			o.value(ad['.name']);
		}
		o.optional = true;

		o = s.option(form.ListValue, 'alarm_delay', _('Delay Alarm'));
		for (let ad of a_delay) {
			o.value(ad['.name']);
		}
		o.optional = true;

		o = s.option(form.ListValue, 'alarm_loss', _('Loss Alarm'));
		for (let al of a_loss) {
			o.value(al['.name']);
		}
		o.optional = true;

		return m.render();
	},
});
