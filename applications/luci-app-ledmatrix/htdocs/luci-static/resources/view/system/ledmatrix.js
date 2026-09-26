'use strict';
'require form';
'require fs';
'require ui';
'require view';

const WIDTH = 24;
const HEIGHT = 67;
const CONTROL = '/usr/sbin/ledmatrixctl';
const DEFAULT_BITMAP = '/usr/share/ledmatrixd/openwrt.bin';

function runControl(args) {
	return fs.exec(CONTROL, args).then(function(res) {
		if (res.code !== 0)
			throw new Error(res.stderr || _('Command failed'));
		return res;
	}).catch(function(err) {
		ui.addNotification(null, E('p', {}, err.message), 'error');
	});
}

return view.extend({
	load: function() {
		return fs.read_direct('/usr/share/ledmatrixd/layout.bin', 'blob').then(function(blob) {
			return blob.arrayBuffer();
		});
	},

	render: function(layoutData) {
		let m, s, o;
		let layout = new Uint8Array(layoutData);
		let pixels = new Uint8Array(201);
		let painting = false;
		let paintValue = true;
		let cells = [];
		let validColumns = 0;
		for (let index = 0; index < WIDTH * HEIGHT; index++)
			if (layout[index >> 3] & (1 << (7 - (index & 7))))
				validColumns = Math.max(validColumns, (index % WIDTH) + 1);

		function pixelIndex(x, y) {
			return y * WIDTH + x;
		}

		function pixelSet(x, y, enabled) {
			let index = pixelIndex(x, y);
			if (!(layout[index >> 3] & (1 << (7 - (index & 7)))))
				return;
			if (enabled)
				pixels[index >> 3] |= 1 << (7 - (index & 7));
			else
				pixels[index >> 3] &= ~(1 << (7 - (index & 7)));
			cells[index].classList.toggle('active', enabled);
		}

		function frameHex() {
			return Array.from(pixels, function(byte) {
				return byte.toString(16).padStart(2, '0');
			}).join('');
		}

		function sendFrame() {
			return runControl(['frame', frameHex()]);
		}

		let matrix = E('div', {
			'class': 'ledmatrix-grid',
			'style': 'display:grid;grid-template-columns:repeat(' + validColumns + ',10px);gap:2px;touch-action:none;user-select:none;width:max-content;padding:12px;background:#111;border-radius:10px'
		});

		for (let y = 0; y < HEIGHT; y++) {
			for (let x = 0; x < WIDTH; x++) {
				let index = pixelIndex(x, y);
				let valid = !!(layout[index >> 3] & (1 << (7 - (index & 7))));
				let cell = E('span', {
					'class': valid ? 'ledmatrix-pixel' : 'ledmatrix-pixel invalid',
					'style': 'width:10px;height:10px;border-radius:2px;background:' + (valid ? '#3a4650' : 'transparent') + ';outline:' + (valid ? '1px solid #596773' : 'none'),
					'title': valid ? '%d, %d'.format(x, y) : _('No physical LED')
				});
				cells[index] = cell;
				if (x >= validColumns)
					continue;
				if (valid) {
					cell.addEventListener('pointerdown', function(ev) {
						ev.preventDefault(); painting = true;
						paintValue = !(pixels[index >> 3] & (1 << (7 - (index & 7))));
						pixelSet(x, y, paintValue);
					});
					cell.addEventListener('pointerenter', function() {
						if (painting) pixelSet(x, y, paintValue);
					});
				}
				matrix.appendChild(cell);
			}
		}
		document.addEventListener('pointerup', function() { painting = false; }, { once: false });

		let style = E('style', {}, [
			'.ledmatrix-pixel.active{background:#f5d547!important;box-shadow:0 0 5px #f5d547}.ledmatrix-pixel:not(.invalid){cursor:crosshair}',
			'.ledmatrix-live-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75em}.ledmatrix-live-grid .btn{width:100%}@media(max-width:600px){.ledmatrix-live-grid{grid-template-columns:1fr}}'
		]);

		m = new form.Map('ledmatrix', _('LED Matrix'),
			_('Configure and test the TP-Link Archer BE800 front-panel display. Changes are applied without rebooting.'));

		s = m.section(form.NamedSection, 'main', 'ledmatrix', _('Display'));
		s.tab('display', _('Display'));
		s.tab('live', _('Live test'));
		s.tab('calibration', _('Calibration'));
		let liveButtons = [];

		o = s.taboption('display', form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('display', form.ListValue, 'mode', _('Mode'));
		o.value('blank', _('Blank'));
		o.value('bitmap', _('Fixed bitmap'));
		o.value('blink', _('Blinking bitmap'));
		o.value('clock', _('Clock'));
		o.value('clock-stacked', _('Stacked clock'));
		o.value('scroll', _('Scrolling text'));
		o.default = 'blank';

		o = s.taboption('display', form.Value, 'bitmap', _('Bitmap path'),
			_('Raw 24 x 67 monochrome bitmap, 201 bytes, row-major and MSB first.'));
		o.depends('mode', 'bitmap');
		o.depends('mode', 'blink');
		o.default = DEFAULT_BITMAP;
		o.placeholder = DEFAULT_BITMAP;
		o.rmempty = false;
		o.retain = true;

		o = s.taboption('display', form.Value, 'text', _('Text'));
		o.depends('mode', 'scroll');
		o.placeholder = 'OPENWRT';
		o.default = 'OPENWRT';
		o.rmempty = false;
		o.retain = true;

		o = s.taboption('display', form.Value, 'interval', _('Frame interval'));
		o.datatype = 'range(100,60000)';
		o.default = '500';
		o.rmempty = false;
		o.description = _('Milliseconds between animation frames.');

		o = s.taboption('display', form.RangeSliderValue, 'brightness', _('Brightness'));
		o.min = 0;
		o.max = 255;
		o.step = 1;
		o.default = '24';

		[
			['blank', _('Blank')], ['bitmap', _('Fixed bitmap')],
			['blink', _('Blinking bitmap')], ['clock', _('Clock')],
			['clock-stacked', _('Stacked clock')], ['scroll', _('Scrolling text')]
		].forEach(function(entry) {
			let mode = entry[0];
			liveButtons.push(E('button', {
				'class': 'btn cbi-button ' + (mode === 'blank' ? 'cbi-button-reset' : 'cbi-button-apply'),
				'type': 'button',
				'click': function() {
					return runControl(['preview', mode]);
				}
			}, [_('Show: %s').format(entry[1])]));
		});
		liveButtons.push(E('button', {
			'class': 'btn cbi-button', 'type': 'button',
			'click': function() { return runControl(['restore']); }
		}, [_('Restore configured mode')]));
		o = s.taboption('live', form.DummyValue, '_live_controls');
		o.rawhtml = true;
		o.cfgvalue = function() { return E('div', { 'class': 'ledmatrix-live-grid' }, liveButtons); };

		o = s.taboption('calibration', form.RangeSliderValue, '_brightness_test', _('Live brightness'));
		o.min = 0;
		o.max = 255;
		o.step = 1;
		o.default = '24';
		o.write = function() {};
		o.remove = function() {};
		o.renderWidget = function(sectionId, optionIndex, cfgvalue) {
			let node = form.RangeSliderValue.prototype.renderWidget.call(this, sectionId, optionIndex, cfgvalue);
			node.addEventListener('change', function(ev) {
				let input = ev.target.closest('input');
				if (input) runControl(['brightness', input.value]);
			});
			return node;
		};

		o = s.taboption('calibration', form.DummyValue, '_matrix', _('Physical LED map'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			let clear = E('button', { 'class': 'btn', 'type': 'button' }, [_('Clear')]);
			let fill = E('button', { 'class': 'btn', 'type': 'button' }, [_('Fill valid LEDs')]);
			let push = E('button', { 'class': 'btn cbi-button-action important', 'type': 'button' }, [_('Push preview')]);
			clear.addEventListener('click', function() {
				pixels.fill(0); cells.forEach(function(cell) { if (cell) cell.classList.remove('active'); }); sendFrame();
			});
			fill.addEventListener('click', function() {
				for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) pixelSet(x, y, true);
			});
			push.addEventListener('click', sendFrame);
			return E('div', {}, [style, E('p', {}, _('Click pixels or drag to paint. Invalid panel coordinates are disabled.')), matrix,
				E('div', { 'style': 'margin-top:1em;display:flex;gap:.5em' }, [clear, fill, push])]);
		};

		return m.render();
	},
});
