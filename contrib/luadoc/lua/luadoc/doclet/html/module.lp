<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
   "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html>
<head>
    <title>Reference</title>
    <link rel="stylesheet" href="<%=luadoc.doclet.html.link('luadoc.css', 'modules/'..module_doc.name)%>" type="text/css" />
	<!--meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/-->
</head>

<body>
<div id="container">

<div id="product">
	<div id="product_logo"></div>
	<div id="product_name"><big><b></b></big></div>
	<div id="product_description"></div>
</div> <!-- id="product" -->

<div id="main">

<div id="navigation">
<%=luadoc.doclet.html.include("menu.lp", { doc=doc, module_doc=module_doc })%>

</div><!-- id="navigation" -->

<div id="content">

<h1>Module <code><%=module_doc.name%></code></h1>

<p><%=module_doc.description%></p>
<%if module_doc.author then%>
<p><b><%= #module_doc.author>1 and "Authors" or "Author" %>:</b>
<table class="authors_list">
<%for _, author in ipairs(module_doc.author) do%>
	<tr><td class="name"><%= author %></td></tr>
<%end%>
</table>
</p>
<%end%>
<%if module_doc.copyright then%>
<p>Copyright&copy; <%=module_doc.copyright%></p>
<%end%>
<%if module_doc.release then%>
<p><small><b>Release:</b> <%=module_doc.release%></small></p>
<%end%>

<%if #module_doc.functions > 0 then%>
<h2>Functions</h2>
<table class="function_list">
<%for _, func_name in ipairs(module_doc.functions) do
  local func_data = module_doc.functions[func_name]%>
	<tr>
	<td class="name" nowrap><%=func_data.private and "local " or ""%><a href="#<%=func_name%>"><%=func_name%></a>&nbsp;(<%=table.concat(module_doc.functions[func_name].param, ", ")%>)</td>
	<td class="summary"><%=module_doc.functions[func_name].summary%></td>
	</tr>
<%end%>
</table>
<%end%>


<%if #module_doc.tables > 0 then%>
<h2>Tables</h2>
<table class="table_list">
<%for _, tab_name in ipairs(module_doc.tables) do%>
	<tr>
	<td class="name" nowrap><a href="#<%=tab_name%>"><%=tab_name%></a></td>
	<td class="summary"><%=module_doc.tables[tab_name].summary%></td>
	</tr>
<%end%>
</table>
<%end%>


<br/>
<br/>


<%if #module_doc.functions > 0 then%>
<h2><a name="functions"></a>Functions</h2>
<dl class="function">
<%for _, func_name in ipairs(module_doc.functions) do%>
<%=luadoc.doclet.html.include("function.lp", { doc=doc, module_doc=module_doc, func=module_doc.functions[func_name] })%>
<%end%>
</dl>
<%end%>


<%if #module_doc.tables > 0 then%>
<h2><a name="tables"></a>Tables</h2>
<dl class="table">
<%for _, tab_name in ipairs(module_doc.tables) do%>
<%=luadoc.doclet.html.include("table.lp", { doc=doc, module_doc=module_doc, tab=module_doc.tables[tab_name] })%>
<%end%>
</dl>
<%end%>


</div> <!-- id="content" -->

</div> <!-- id="main" -->

<div id="about">
	<p><a href="http://validator.w3.org/check?uri=referer"><img src="http://www.w3.org/Icons/valid-xhtml10" alt="Valid XHTML 1.0!" height="31" width="88" /></a></p>
</div> <!-- id="about" -->

</div> <!-- id="container" -->	
</body>
</html>
