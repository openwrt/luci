/* MochiKit.JsonRpc */

if (typeof(dojo) != 'undefined') {
    dojo.provide("MochiKit.JsonRpc");
    dojo.require("MochiKit.Base");
    dojo.require("MochiKit.DOM");
    dojo.require("MochiKit.Async");
}

if (typeof(JSAN) != 'undefined') {
    JSAN.use("MochiKit.Base", []);
    JSAN.use("MochiKit.DOM", []);
    JSAN.use("MochiKit.Async", []);
}

try {
    if (typeof(MochiKit.Base) == 'undefined' ||
        typeof(MochiKit.DOM) == 'undefined' ||
        typeof(MochiKit.Async) == 'undefined') {
        throw "";
    }
} catch (e) {
    throw "MochiKit.JsonRpc depends on MochiKit.Base, MochiKit.DOM and MochiKit.Async";
}

if (typeof(MochiKit.JsonRpc) == 'undefined') {
    MochiKit.JsonRpc = {};
}

MochiKit.JsonRpc.NAME = "MochiKit.JsonRpc";
MochiKit.JsonRpc.VERSION = "0.90";

MochiKit.JsonRpc.__repr__ = function () {
    return "[" + this.NAME + " " + this.VERSION + "]";
}

MochiKit.JsonRpc.toString = function () {
    return this.__repr__();
}

MochiKit.JsonRpc.JsonRpcError = function (message) {
    this.message = message;
    this.name = 'JsonRpcError';
}

MochiKit.JsonRpc.JsonRpcError.prototype = new Error();
MochiKit.JsonRpc.JsonRpcError.prototype.repr = function () {
    return 'JsonRpcError(' + this.message + ')';
}

MochiKit.JsonRpc.JsonRpcError.prototype.toString = function () {
    return this.repr();
}

MochiKit.JsonRpc.jsonObject = function (o) {
    var attrs=[];
    for(attr in o){
        if(typeof o[attr] != "function"){
            attrs.push('"' + attr + '": ' + json(o[attr]));
        }
    }
    return "{" + attrs.join(", ") + "}";
}

MochiKit.JsonRpc.isObject = function (o) {
    return true;
}

MochiKit.JsonRpc.jsonArray = function (o) {
    return "[" + MochiKit.Base.map(json, o).join(", ") + "]";
}

var MB = MochiKit.Base

MochiKit.JsonRpc.jsonRegistry = new MochiKit.Base.AdapterRegistry();
MochiKit.JsonRpc.jsonRegistry.register('arrayLike',MB.isArrayLike,MochiKit.JsonRpc.jsonArray);
MochiKit.JsonRpc.jsonRegistry.register("string", MB.typeMatcher("string"), MB.reprString);
MochiKit.JsonRpc.jsonRegistry.register("numbers", MB.typeMatcher("number", "boolean"), MB.reprNumber);
MochiKit.JsonRpc.jsonRegistry.register("undefined", MB.isUndefined, MB.reprUndefined);
MochiKit.JsonRpc.jsonRegistry.register("null", MB.isNull, MB.reprNull);
MochiKit.JsonRpc.jsonRegistry.register("objectLike", MochiKit.JsonRpc.isObject, MochiKit.JsonRpc.jsonObject);

MochiKit.JsonRpc.json = function (o) {
    try {
        if (typeof(o.__json__) == 'function') {
            return o.__json__();
        } else if (typeof(o.json) == 'function' && o.json != arguments.callee) {
            return o.json();
        }
        return jsonRegistry.match(o);
    } catch (e) {
        if (typeof(o.NAME) == 'string' && (
                o.toString == Function.prototype.toString ||
                o.toString == Object.prototype.toString
            )) {
            return o.NAME;
        }
        return o;
    }

}


MochiKit.JsonRpc.JsonRpcCall = function (method,params) {
    this.method = method;
    this.params = params;
    this.id = '0';
}

MochiKit.JsonRpc.JsonRpcProxy = function (url,methNames) {
    MochiKit.Base.bindMethods(this);
    this.url = url;
    if (methNames) {
        MochiKit.Base.map(this._proxyMethod,methNames);
    }
}

update(MochiKit.JsonRpc.JsonRpcProxy.prototype, {
    'call': function () {
        var arglist = MochiKit.Base.map(null,arguments)
        var methname = arglist.shift()
        log(arglist);
        var callobj = new MochiKit.JsonRpc.JsonRpcCall(methname,arglist);
        var callstr = json(callobj);
        var req = MochiKit.Async.getXMLHttpRequest();
        req.open("POST",this.url,true);
        req.setRequestHeader("Content-Type","text/plain");
        req.setRequestHeader("Content-Length",callstr.length);
        var d = MochiKit.Async.sendXMLHttpRequest(req,callstr);
        d.addCallback(MochiKit.Async.evalJSONRequest);
        d.addCallback(this._extractResult);

        return d
    },
    'addSingleMethod': function (methName) {
        if (methName) {
            this._proxyMethod(methName);
        }
    },
    'addMethods': function (methNames) {
        if (methNames) {
            MochiKit.Base.map(this._proxyMethod,methNames);
        }
    },
    '_extractResult': function (resp) {
        if (!resp.error){
            return resp.result;
        } else {
            throw new MochiKit.JsonRpc.JsonRpcError(resp.error);
        }
    },
    '_proxyMethod': function (methname) {
        this[methname] = MochiKit.Base.partial(this.call,methname);
    }
});

MochiKit.JsonRpc.DomObjectFromJson = function (){
    var retval = false;
    if (arguments.length == 1) {
        var arg = arguments[0];
        if (typeof(arg) == 'string'){
            retval = MochiKit.DOM.SPAN(null,arg);
        } else {
            var objrepr = arguments[0];
            var elem = document.createElement(objrepr[0]);
            var attrs = objrepr[1];
            if (attrs) {
                MochiKit.DOM.updateNodeAttributes(elem, attrs);
            }
            if (objrepr.length >= 3){
                var extraobj = objrepr[2]
                for (var i=0;i<extraobj.length;i++) {
                    var value = MochiKit.JsonRpc.DomObjectFromJson(extraobj[i]);
                    if (value) {
                        elem.appendChild(value);
                    }
                }
            }
            retval =  elem;
        }
    }
    return retval;
};

MochiKit.JsonRpc.EXPORT = [
    "JsonRpcError",
    "JsonRpcProxy",
];

MochiKit.JsonRpc.EXPORT_OK = [
    "jsonObject",
    "jsonArray",
    "jsonRegistry",
    "json",
    "JsonRpcCall",
    "DomObjectFromJson",
];

MochiKit.JsonRpc.__new__ = function () {

    this.EXPORT_TAGS = {
        ":common": this.EXPORT,
        ":all": MochiKit.Base.concat(this.EXPORT, this.EXPORT_OK)
    };

    MochiKit.Base.nameFunctions(this);

};

MochiKit.JsonRpc.__new__();

if ((typeof(JSAN) == 'undefined' && typeof(dojo) == 'undefined')
    || (typeof(MochiKit.__compat__) == 'boolean' && MochiKit.__compat__)) {
    (function (self) {
            var all = self.EXPORT_TAGS[":all"];
            for (var i = 0; i < all.length; i++) {
                this[all[i]] = self[all[i]];
            }
        })(MochiKit.JsonRpc);
}
