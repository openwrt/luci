'use strict';
'require baseclass';
'require fs';
'require form';

return baseclass.extend({
	title: _('DF Plugin Configuration'),
	description: _('The df plugin collects statistics about the disk space usage on different devices, mount points or filesystem types.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.DynamicList, 'Devices', _('Monitor devices'));
		o.optional = true;
		o.depends('enable', '1');
		o.load = function(section_id) {
			return fs.lines('/proc/partitions').then(L.bind(function(lines) {
				var parts = [];

				for (var i = 0; i < lines.length; i++) {
					var line = L.toArray(lines[i]);
					if (!isNaN(line[0]))
						parts.push('/dev/' + line[3]);
				}

				parts.sort();

				for (var i = 0; i < parts.length; i++)
					this.value(parts[i]);

				return this.super('load', [section_id]);
			}, this));
		};

		o = s.option(form.DynamicList, 'MountPoints', _('Monitor mount points'));
		o.default = '/overlay';
		o.optional = true;
		o.depends('enable', '1');
		o.load = function(section_id) {
			return fs.lines('/proc/mounts').then(L.bind(function(lines) {
				var mounts = {};

				for (var i = 0; i < lines.length; i++) {
					var line = L.toArray(lines[i]);
					mounts[line[1]] = true;
				}

				mounts = Object.keys(mounts).sort();

				for (var i = 0; i < mounts.length; i++)
					this.value(mounts[i]);

				return this.super('load', [section_id]);
			}, this));
		};

		o = s.option(form.DynamicList, 'FSTypes', _('Monitor filesystem types'));
		o.default = 'tmpfs';
		o.optional = true;
		o.depends('enable', '1');
		o.load = function(section_id) {
			return Promise.all([
				fs.lines('/etc/filesystems'),
				fs.lines('/proc/filesystems')
			]).then(L.bind(function(lines) {
				var fslines = lines[0].concat(lines[1]),
				    fstypes = {};

				for (var i = 0; i < fslines.length; i++) {
					var line = L.toArray(fslines[i]);

					if (line.length == 2 && line[0] == 'nodev')
						continue;

					fstypes[line.pop()] = true;
				}

				fstypes = Object.keys(fstypes).sort();

				for (var i = 0; i < fstypes.length; i++)
					this.value(fstypes[i]);

				return this.super('load', [section_id]);
			}, this));
		};

		o = s.option(form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.depends('enable', '1');

		o = s.option(form.Flag, 'ValuesPercentage', _('Free space, reserved space and used space is reported as relative values'));
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var devs = L.toArray(section.Devices),
		    mounts = L.toArray(section.MountPoints),
		    fstypes = L.toArray(section.FSTypes),
		    count = devs.length + mounts.length + fstypes.length,
		    invert = section.IgnoreSelected == '1';

		if (count == 0)
			return _('Monitoring all partitions');
		else
			return (invert ? _('Monitoring all except %s, %s, %s') : _('Monitoring %s, %s, %s')).format(
				N_(devs.length, 'one device', '%d devices').format(devs.length),
				N_(mounts.length, 'one mount', '%d mounts').format(mounts.length),
				N_(fstypes.length, 'one filesystem type', '%d filesystem types').format(fstypes.length)
			);
	}
});
