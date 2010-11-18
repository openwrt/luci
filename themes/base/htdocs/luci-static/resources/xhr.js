/*
 * xhr.js - XMLHttpRequest helper class
 * (c) 2008-2010 Jo-Philipp Wich
 */

XHR = function()
{
	this.reinit = function()
	{
		if( window.XMLHttpRequest ) {
			this._xmlHttp = new XMLHttpRequest();
		}
		else if( window.ActiveXObject ) {
			this._xmlHttp = new ActiveXObject("Microsoft.XMLHTTP");
		}
		else {
			alert("xhr.js: XMLHttpRequest is not supported by this browser!");
		}
	}

	this.busy = function() {
		switch( this._xmlHttp.readyState )
		{
			case 1:
			case 2:
			case 3:
				return true;

			default:
				return false;
		}
	}

	this.abort = function() {
		if( this.busy() )
			this._xmlHttp.abort();
	}

	this.get = function(url,data,callback)
	{
		this.reinit();

		var xhr  = this._xmlHttp;
		var code = this._encode( data );

		url = location.protocol + '//' + location.hostname +
			( location.port ? ':' + location.port : '' ) + url;

		if( code )
			if( url.substr(url.length-1,1) == '&' )
				url += code;
			else
				url += '?' + code;

		xhr.open( 'GET', url, true );

		xhr.onreadystatechange = function()
		{
			if( xhr.readyState == 4 ) {
				var json = null;
				if( xhr.getResponseHeader("Content-Type") == "application/json" ) {
					try {
						json = eval('(' + xhr.responseText + ')');
					}
					catch(e) {
						json = null;
					}
				}

				callback( xhr, json );
			}
		}

		xhr.send( null );
	}

	this.post = function(url,data,callback)
	{
		this.reinit();

		var xhr  = this._xmlHttp;
		var code = this._encode( data );

		xhr.onreadystatechange = function()
		{
			if( xhr.readyState == 4 )
				callback( xhr );
		}

		xhr.open( 'POST', url, true );
		xhr.setRequestHeader( 'Content-type', 'application/x-www-form-urlencoded' );
		xhr.setRequestHeader( 'Content-length', code.length );
		xhr.setRequestHeader( 'Connection', 'close' );
		xhr.send( code );
	}

	this.cancel = function()
	{
		this._xmlHttp.onreadystatechange = function(){};
		this._xmlHttp.abort();
	}

	this.send_form = function(form,callback,extra_values)
	{
		var code = '';

		for( var i = 0; i < form.elements.length; i++ )
		{
			var e = form.elements[i];

			if( e.options )
			{
				code += ( code ? '&' : '' ) +
					form.elements[i].name + '=' + encodeURIComponent(
						e.options[e.selectedIndex].value
					);
			}
			else if( e.length )
			{
				for( var j = 0; j < e.length; j++ )
					if( e[j].name ) {
						code += ( code ? '&' : '' ) +
							e[j].name + '=' + encodeURIComponent( e[j].value );
					}
			}
			else
			{
				code += ( code ? '&' : '' ) +
					e.name + '=' + encodeURIComponent( e.value );
			}
		}

		if( typeof extra_values == 'object' )
			for( var key in extra_values )
				code += ( code ? '&' : '' ) +
					key + '=' + encodeURIComponent( extra_values[key] );

		return(
			( form.method == 'get' )
				? this.get( form.getAttribute('action'), code, callback )
				: this.post( form.getAttribute('action'), code, callback )
		);
	}

	this._encode = function(obj)
	{
		obj = obj ? obj : { };
		obj['_'] = Math.random();

		if( typeof obj == 'object' )
		{
			var code = '';
			var self = this;

			for( var k in obj )
				code += ( code ? '&' : '' ) +
					k + '=' + encodeURIComponent( obj[k] );

			return code;
		}

		return obj;
	}
}
