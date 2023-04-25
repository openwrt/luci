'use strict';
'require baseclass';
'require fs';
'require uci';

return baseclass.extend({
	title: _('miniDLNA Status'),

	load: function() {
		return uci.load('minidlna').then(function() {
			var port = +uci.get_first('minidlna', 'minidlna', 'port');

			if (isNaN(port) || port < 0 || port > 65535)
				port = 8200;

			return L.resolveDefault(fs.exec_direct('/usr/bin/wget', [ '-q', 'http://127.0.0.1:%d/'.format(port), '-O', '-' ]), null);
		});
	},

	render: function(html) {
		if (html == null)
			return E('em', {}, [ _('The miniDLNA service is not running.') ]);

		var audio = html.match(/Audio files<\/td><td>(\d+)/),
		    video = html.match(/Video files<\/td><td>(\d+)/),
		    image = html.match(/Image files<\/td><td>(\d+)/);

		return _('The miniDLNA service is active, serving %d audio, %d video and %d image files.')
			.format(audio ? +audio[1] : 0, video ? +video[1] : 0, image ? +image[1] : 0);
	}
});
