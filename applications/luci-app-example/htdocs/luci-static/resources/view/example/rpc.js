'use strict';
'require form';
'require rpc';
'require view';

/*
Declare the RPC calls that are needed. The object value maps to the name
listed by the shell command

$ ubus list

Custom scripts can be placed in /usr/libexec/rpcd, and must emit JSON. The name of the file
in that directory will be the value for the object key in the declared map.

Permissions to make these calls must be granted in /usr/share/rpcd/acl.d
via a file named the same as the application package name (luci-app-example)
*/
var load_sample1 = rpc.declare({
	object: 'luci.example',
	method: 'get_sample1'
});
// Out of the box, this one will be blocked by the framework because there is
// no ACL granting permission.
var load_sample3 = rpc.declare({
	object: 'luci.example',
	method: 'get_sample3'
});


return view.extend({
	generic_failure: function (message) {
		// Map an error message into a div for rendering
		return E('div', {
			'class': 'error'
		}, [_('RPC call failure: '), message])
	},
	render_sample1_using_array: function (sample) {
		console.log('render_sample1_using_array()');
		console.log(sample);
		/*
		Some simple error handling. If the RPC APIs return a JSON structure of the 
		form {"error": "Some error message"} when there's a failure, then the UI
		can check for the presence of the error attribute, and render a failure
		widget instead of breaking completely.
		*/
		if (sample.error) {
			return this.generic_failure(sample.error)
		}

		/*
		Approach 1 for mapping JSON data to a simple table for display. The listing looks
		a bit like key/value pairs, but is actually just an array. The loop logic later
		on must iterate by 2 to get the labels.
		*/
		const fields = [
			_('Cats'), sample.num_cats,
			_('Dogs'), sample.num_dogs,
			_('Parakeets'), sample.num_parakeets,
			_('Should be "Not found"'), sample.not_found,
			_('Is this real?'), sample.is_this_real ? _('Yes') : _('No'),
		];

		/*
		Declare a table element using an automatically available function - E(). E() 
		produces a DOM node, where the first argument is the type of node to produce,
		the second argument is an object of attributes for that node, and the third
		argument is an array of child nodes (which can also be E() calls).
		*/
		var table = E('table', {
			'class': 'table',
			'id': 'approach-1'
		});

		// Loop over the array, starting from index 0. Every even-indexed second element is
		// the label (left column) and the odd-indexed elements are the value (right column)
		for (var i = 0; i < fields.length; i += 2) {
			table.appendChild(
				E('tr', {
					'class': 'tr'
				}, [
					E('td', {
						'class': 'td left',
						'width': '33%'
					}, [fields[i]]),
					E('td', {
						'class': 'td left'
					}, [(fields[i + 1] != null) ? fields[i + 1] : _('Not found')])
				]));
		}
		return table;
	},

	/*
	load() is called on first page load, and the results of each promise are
	placed in an array in the call order. This array is passed to the render()
	function as the first argument.
	*/
	load: function () {
		return Promise.all([
			load_sample1()
		]);
	},
	// render() is called by the LuCI framework to do any data manipulation, and the
	// return is used to modify the DOM that the browser shows.
	render: function (data) {
		// data[0] will be the result from load_sample1
		var sample1 = data[0] || {};
		// data[1] will be the result from load_sample_yaml
		var sample_yaml = data[1] || {};

		// Render the tables as individual sections.
		return E('div', {}, [
			E('div', {
				'class': 'cbi-section warning'
			}, _('See browser console for raw data')),
			E('div', {
				'class': 'cbi-map',
				'id': 'map'
			}, [
				E('div', {
					'class': 'cbi-section',
					'id': 'cbi-sample-js'
				}, [
					E('div', {
						'class': 'left'
					}, [
						// _() notation on strings is used for translation detection
						E('h3', _('Sample JS via RPC')),
						E('div', {}), _(
							"JSON converted to table via array building and loop"
							),
						this.render_sample1_using_array(sample1)
					]),
				]),
			]),
		]);
	},
	/*
	Since this is a view-only screen, the handlers are disabled
	Normally, when using something like Map or JSONMap, you would 
	not null out these handlers, so that the form can be saved/applied.
    
	With a RPC data source, you would need to define custom handlers
	that verify the changes, and make RPC calls to a backend that can
	process the request.
	*/
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
})