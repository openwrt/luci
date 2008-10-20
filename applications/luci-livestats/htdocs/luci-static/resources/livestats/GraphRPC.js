function Graph(container, id, options, transform) {
	if( !options ) options = { };

	this.id        = id;
	this.cols      = 100;
	this.type      = "line";
	this.options   = options;
	this.transform = transform;
	this.dataset   = {};

	var graph = document.createElement('div');
	var label = document.createElement('h2');
		label.innerHTML = options.title
			? options.title.replace("%s", id ) : id;

	container.appendChild( label );
	container.appendChild( graph );

	this.canvas = document.createElement('canvas');
	graph.appendChild( this.canvas );

	this.canvas.id = id;
	this.canvas.width  = ( options.width  || graph.offsetWidth - 20 );
	this.canvas.height = ( options.height || 300 );
}

Graph.prototype.addDataset = function(name, ds) {
	if( !this.layout ) {
		this.layout = new PlotKit.Layout( this.type, this.options );
	}

	if( !ds ) {
		ds = new Array();
		for( var i = 0; i < this.cols; i++ )
			ds[i] = new Array( i, 0 );
	}

	this.dataset[name] = ds;
	this.layout.addDataset(name, ds);
}

Graph.prototype.updateDataset = function(name, value) {
	if( this.dataset[name] ) {
		var ds = this.dataset[name];

		for( var i = 1; i < this.cols; i++ )
			ds[i-1][1] = ds[i][1];

		value = Math.abs( parseFloat(value) || 0 );

		if( this.transform ) {
			value = ( ds[this.cols-1][1] > 0 )
				? this.transform(value, ds[this.cols-1][1]) : 0.01;
		}

		ds[this.cols-1][1] = value;
		this.layout.addDataset(name, ds);
	}
}

Graph.prototype.draw = function( options ) {
	if( this.layout ) {
		this.plotter = new PlotKit.CanvasRenderer(
			this.canvas, this.layout, this.options || options || {}
		);

		this.layout.evaluate();
		this.plotter.render();
	}
}

Graph.prototype.redraw = function() {
	if( this.layout && this.plotter ) {
		this.layout.evaluate();
		this.plotter.clear();
		this.plotter.render();
	}
}


function GraphRPC(container, uri, action, interval, datasources, options, transform) {
	this.ds        = datasources;
	this.uri       = uri
	this.action    = action;
	this.options   = options || { };
	this.container = container;
	this.transform = transform;
	this.proxy     = new MochiKit.JsonRpc.JsonRpcProxy(uri, [action]);
	this.graphs    = new Object();

	this.requestData();

	if( interval ) {
		var self = this;
		window.setInterval(function(){self.requestData()}, interval);
	}
}

GraphRPC.prototype.requestData = function() {
	var r = this.proxy[this.action](); var self = this;
	r.addCallback(function(r){ self.dispatchResponse(r) });
	r.addErrback(function(e){ throw('Error: ' + e) });
}

GraphRPC.prototype.dispatchResponse = function(response) {
	var instances;
	if( this.options.instances ) {
		instances = this.options.instances;
	}
	else {
		instances = new Array();
		for( var instance in response ) {
			instances[instances.length] = instance;
		}
	}

	for( var j = 0; j < instances.length; j++ ) {
		var instance = instances[j];

		if( this.options.separateDS ) {
			for( var i = 0; i < this.ds.length; i += 2 ) {
				var name = this.ds[i+1] || this.ds[i];
				var gid  = instance + '-' + name;
				var otle = this.options.title || instance;

				if( !this.graphs[gid] ) {
					this.options.title = otle.replace('%s', instance) + ': ' + name;
					this.graphs[gid] = new Graph(
						this.container, gid, this.options, this.transform
					);

					this.graphs[gid].addDataset(name);
					this.graphs[gid].draw();
					this.options.title = otle;
				}
				else
				{
					this.graphs[gid].updateDataset(
						name, instance
							? response[instance][this.ds[i]]
							: response[this.ds[i]]
					);
					this.graphs[gid].redraw();
				}
			}
		}
		else {
			var gid = instance || 'livegraph';
			if( !this.graphs[gid] ) {
				this.graphs[gid] = new Graph(
					this.container, gid, this.options, this.transform
				);

				for( var i = 0; i < this.ds.length; i += 2 ) {
					var name = this.ds[i+1] || this.ds[i];
					this.graphs[gid].addDataset(name);
				}

				this.graphs[gid].draw();
			}
			else {
				for( var i = 0; i < this.ds.length; i += 2 ) {
					var name = this.ds[i+1] || this.ds[i];
					this.graphs[gid].updateDataset(
						name, instance
							? response[instance][this.ds[i]]
							: response[this.ds[i]]
					);
				}

				this.graphs[gid].redraw();
			}
		}
	}
}
