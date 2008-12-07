/*
    PlotKit Legend
    ==============

    Handles laying out legend into a DIV element.
    Design taken from comments of Julien Wajsberg (http://
groups.google.com/group/plotkit/browse_thread/thread/2494bd88e6e9956d)
    and Niel Domingo (http://nieldomingo.blogspot.com/2007/03/legend-
for-plotkit-bar-charts.html).

    Copyright
    ---------
    Copyright 2007 (c) Ashley Martens <ashleym_72^yahoo.com>
    For use under the BSD license. <http://www.liquidx.net/plotkit>

*/

try {
    if (typeof(MochiKit.Base) == 'undefined'   ||
        typeof(MochiKit.DOM) == 'undefined'    ||
        typeof(MochiKit.Color) == 'undefined'  ||
        typeof(MochiKit.Format) == 'undefined' ||
        typeof(PlotKit.Layout) == 'undefined'  ||
        typeof(PlotKit.Base) == 'undefined')
    {
        throw "";
    }
}
catch (e) {
    throw "PlotKit depends on MochiKit.{Base,Color,DOM,Format}"
}

if (typeof(PlotKit.LegendRenderer) == 'undefined') {
    PlotKit.LegendRenderer = {};
}

PlotKit.LegendRenderer = function(element, layout, options) {
    if (arguments.length  > 0)
        this.__init__(element, layout, options);
};


PlotKit.LegendRenderer.NAME = "PlotKit.LegendRenderer";
PlotKit.LegendRenderer.VERSION = PlotKit.VERSION;

PlotKit.LegendRenderer.__repr__ = function() {
    return "[" + this.NAME + " " + this.VERSION + "]";
};

PlotKit.LegendRenderer.toString = function() {
    return this.__repr__();
}

PlotKit.LegendRenderer.prototype.__init__ = function(element, layout,
options) {
    var isNil = MochiKit.Base.isUndefinedOrNull;
    var Color = MochiKit.Color.Color;

    this.options = {
        "colorScheme": PlotKit.Base.palette(PlotKit.Base.baseColors()
[0]),
        "legendStyle": "table",
        "tableColumns": 1
    };
    MochiKit.Base.update(this.options, options ? options : {});

    this.layout = layout;
    this.element = MochiKit.DOM.getElement(element);
    // --- check whether everything is ok before we return

    if (isNil(this.element))
        throw "CRILegend() - passed legend is not found";
};

PlotKit.LegendRenderer.prototype.render = function() {
    var colorScheme = this.options.colorScheme;
    var setNames = PlotKit.Base.keys(this.layout.datasets);
    
        MochiKit.DOM.updateNodeAttributes(this.element,
        {"style":
      {"margin":"0"
      ,"padding":"0"
      }
    });


    var ul = null;
    if (this.options.legendStyle == "table")
        ul = this._renderListTable(colorScheme, setNames);
    else
        ul = this._renderList(colorScheme, setNames);
    MochiKit.DOM.appendChildNodes(this.element, ul);
 
};

PlotKit.LegendRenderer.prototype._renderList = function(colorScheme,
setNames) {
    var ul = document.createElement("ul");
    ul.style.listStyle="none";
    ul.style.margin="0";
    ul.style.padding="0";

    var colorCount = colorScheme.length;
    var setCount = setNames.length;

    for (var i = 0; i < setCount; i++) {
        var setName = setNames[i];
        var color = colorScheme[i%colorCount];
        var le = this._renderElement(setName, color.toRGBString());
        ul.appendChild(le);
    }

    return ul;
};

PlotKit.LegendRenderer.prototype._renderElement = function(title,
color) {
    var le = MochiKit.DOM.createDOM("li");
    le.style.listStyle="none";
    le.style.margin="0 0 5px 0";
    le.style.padding="0";

    var box = MochiKit.DOM.createDOM("div");
    box.style.backgroundColor=color;
    box.style.width="2em";
    box.style.height=".9em";
    box.style.border="1px solid black";
    box.style.margin="0 5px 0 0";
    box.style.padding="0";
    box.style.float="left";
    box.style.cssFloat="left";
    box.style.clear="left";
    box.style.cssClear="left";

    var span = MochiKit.DOM.createDOM("span");
    MochiKit.DOM.appendChildNodes(span,
document.createTextNode(title));

    MochiKit.DOM.appendChildNodes(le, box, span);

    return le;
};

PlotKit.LegendRenderer.prototype._renderListTable =
function(colorScheme, setNames) {
        var tabhead = THEAD(null);
        var tabfoot = TFOOT(null);

        var tabbody = partial(TBODY, null);
        var i = 0;
        var colorcount = colorScheme.length;
        var tabrow;
        var columns = this.options.tableColumns;
        for (var label in setNames)
        {
                var legendcolor = colorScheme[i%colorcount];
                var legendbox = DIV({'class': 'legendbox', 'className':
'legendbox'});
                legendbox.style.width = "10px";
                legendbox.style.height = "10px";
                legendbox.style.backgroundColor = legendcolor.toHexString();
                legendbox.style.borderWidth = "1px";
                legendbox.style.borderStyle = "solid";
                legendbox.style.borderColor = "#000000";
                var boxcell = TD(null, legendbox);

                var labelcell = TD({'class': 'legendlabel', 'className':
'legendlabel'}, setNames[i]);
                labelcell.style.font = 'normal 10pt arial';

                if (!(i % columns))
                {
                    tabrow = partial(TR, null);
                }
                tabrow = partial(tabrow, boxcell, labelcell);
                if (i % columns)
                {
                    tabrow = tabrow(null);
                    tabbody = partial(tabbody, tabrow);
                }
                i++;
        }
        if ((setNames % columns))
        {
                tabrow = tabrow(TD(null), TD(null));
                tabbody = partial(tabbody, tabrow);
        }
        tabbody = tabbody(null);

        tab = TABLE({'class': 'legendcontainer', 'className':
'legendcontainer'}, tabhead, tabfoot, tabbody);
        tab.style.marginTop = '1em';
        tab.style.marginLeft = '1.5em';
        tab.style.marginBottom = '1em';
        tab.style.borderWidth = '1px';
        tab.style.borderStyle = 'solid';
        tab.style.borderColor = '#000000';

        return tab;
};

// Namespace Iniitialisation

PlotKit.Legend = {}
PlotKit.Legend.LegendRenderer = PlotKit.LegendRenderer;


PlotKit.Legend.EXPORT = [
    "LegendRenderer"
];

PlotKit.Legend.EXPORT_OK = [
    "LegendRenderer"
];

PlotKit.Legend.__new__ = function() {
    var m = MochiKit.Base;

    m.nameFunctions(this);

    this.EXPORT_TAGS = {
        ":common": this.EXPORT,
        ":all": m.concat(this.EXPORT, this.EXPORT_OK)
    };
};

PlotKit.Legend.__new__();
MochiKit.Base._exportSymbols(this, PlotKit.Legend);