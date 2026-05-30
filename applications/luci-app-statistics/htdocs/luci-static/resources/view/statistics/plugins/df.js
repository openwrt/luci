'use strict';
'require baseclass';
'require fs';
'require form';

return baseclass.extend({
	title: _('DF Plugin Configuration'),
	description: _('The df plugin collects statistics about the disk space usage on different devices, mount points or filesystem types.'),

	addFormOptions(s) {
		let o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.DynamicList, 'Devices', _('Monitor devices'));
		o.optional = true;
		o.depends('enable', '1');
		o.load = function(section_id) {
			return fs.lines('/proc/partitions').then(L.bind(function(lines) {
				const parts = [];

				for (let l of lines) {
					const line = L.toArray(l);
					if (!isNaN(line[0]))
						parts.push('/dev/' + line[3]);
				}

				parts.sort();

				for (let p of parts)
					this.value(p);

				return this.super('load', [section_id]);
			}, this));
		};

		o = s.option(form.DynamicList, 'MountPoints', _('Monitor mount points'));
		o.default = '/overlay';
		o.optional = true;
		o.depends('enable', '1');
		o.load = function(section_id) {
			return fs.lines('/proc/mounts').then(L.bind(function(lines) {
				let mounts = {};

				for (let l of lines) {
					const line = L.toArray(l);
					mounts[line[1]] = true;
				}

				mounts = Object.keys(mounts).sort();

				for (let m of mounts)
					this.value(m);

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
				const fslines = lines[0].concat(lines[1]);
				let fstypes = {};

				for (let fsl of fslines) {
					var line = L.toArray(fsl);

					if (line.length == 2 && line[0] == 'nodev')
						continue;

					fstypes[line.pop()] = true;
				}

				fstypes = Object.keys(fstypes).sort();

				for (let fst of fstypes)
					this.value(fst);

				return this.super('load', [section_id]);
			}, this));
		};

		o = s.option(form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.depends('enable', '1');

		o = s.option(form.Flag, 'ValuesPercentage', _('Free space, reserved space and used space is reported as relative values'));
		o.depends('enable', '1');
	},

	configSummary(section) {
		const devs = L.toArray(section.Devices);
		const mounts = L.toArray(section.MountPoints);
		const fstypes = L.toArray(section.FSTypes);
		const count = devs.length + mounts.length + fstypes.length;
		const invert = section.IgnoreSelected == '1';

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
