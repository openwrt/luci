'use strict';
'require baseclass';
'require fs';
'require form';

return baseclass.extend({
	title: _('IRQ Plugin Configuration'),
	description: _('The irq plugin will monitor the rate of issues per second for each selected interrupt. If no interrupt is selected then all interrupts are monitored.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.DynamicList, 'Irqs', _('Monitor interrupts'));
		o.optional = true;
		o.multiple = true;
		o.depends('enable', '1');
		o.load = function(section_id) {
			return fs.trimmed('/proc/interrupts').then(L.bind(function(str) {
				var lines = str.split(/\n/),
				    cpus = L.toArray(lines[0]);

				for (var i = 1; i < lines.length; i++) {
					var line = lines[i],
					    m = lines[i].match(/^\s*([^\s:]+):/);

					if (!m)
						continue;

					line = line.replace(/^[^:]+:\s+/, '');

					for (var j = 0; j < cpus.length; j++)
						line = line.replace(/^\d+\s*/, '');

					var desc = line.split(/ {2,}/).join(', ');

					this.value(m[1], '%s (%s)'.format(m[1], desc || '-'));
				}

				return this.super('load', [section_id]);
			}, this));
		};

		o = s.option(form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var irqs = L.toArray(section.Irqs),
		    invert = section.IgnoreSelected == '1';

		if (irqs.length == 0)
			return _('Monitoring all interrupts');
		else if (invert)
			return N_(irqs.length, 'Monitoring all but one interrupt', 'Monitoring all but %d interrupts').format(irqs.length);
		else
			return N_(irqs.length, 'Monitoring one interrupt', 'Monitoring %d interrupts').format(irqs.length);
	}
});
