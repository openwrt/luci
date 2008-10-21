/*
Copyright (C) 2007, 2008  Alina Friedrichsen <x-alina@gmx.net>

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.
*/

var XMLNS_XMLNS = "http://www.w3.org/2000/xmlns/";
var XMLNS_XML = "http://www.w3.org/XML/1998/namespace";
var XMLNS_XHTML = "http://www.w3.org/1999/xhtml";

function W3CDOM_Event(currentTarget) {
	VarType.needObject(currentTarget);
	this.currentTarget = currentTarget;
	this.preventDefault = function() { window.event.returnValue = false; };
	return this;
}

function XHTML1() {
}

XHTML1.isDOMSupported = function() {
	if(!document.getElementById) return false;
	if(!(window.addEventListener || window.attachEvent)) return false;
	return true;
};

XHTML1.isXHTML = function() {
	if(document.documentElement.nodeName == "HTML") return false;
	return true;
};

XHTML1.addEventListener = function(target, type, listener) {
	VarType.needObject(target);
	type = VarType.toStr(type);
	VarType.needFunction(listener);

	if(target.addEventListener) {
		target.addEventListener(type, listener, false);
	}
	else if(target.attachEvent) {
		target.attachEvent("on" + type, function() { listener(new W3CDOM_Event(target)); } );
	}
};

XHTML1.createElement = function(tagName) {
	tagName = VarType.toStr(tagName);

	if(XHTML1.isXHTML()) {
		return document.createElementNS(XMLNS_XHTML, tagName.toLowerCase());
	}

	return document.createElement(tagName.toUpperCase());
};

XHTML1.getElementsByTagName = function(tagName) {
	tagName = VarType.toStr(tagName);

	if(XHTML1.isXHTML()) {
		return document.getElementsByTagNameNS(XMLNS_XHTML, tagName.toLowerCase());
	}

	return document.getElementsByTagName(tagName.toUpperCase());
};

XHTML1.isElement = function(node, tagName) {
	VarType.needNode(node);
	tagName = VarType.toStr(tagName);

	if(node.nodeType == 1) {
		if(XHTML1.isXHTML()) {
			if(node.namespaceURI == XMLNS_XHTML) {
				if(node.localName == tagName.toLowerCase()) return true;
			}
		} else {
			if(node.nodeName == tagName.toUpperCase()) return true;
		}
	}

	return false;
};

XHTML1.getAttribute = function(element, name) {
	VarType.needNode(element, 1);
	name = VarType.toStr(name);

	name = name.toLowerCase();

	if(XHTML1.isXHTML()) {
		return element.getAttributeNS(null, name);
	}

	if(name == "class") {
		return element.className;
	}

	return element.getAttribute(name);
};

XHTML1.setAttribute = function(element, name, value) {
	VarType.needNode(element, 1);
	name = VarType.toStr(name);
	value = VarType.toStr(value);

	name = name.toLowerCase();

	if(XHTML1.isXHTML()) {
		element.setAttributeNS(null, name, value);
		return;
	}

	if(name == "class") {
		element.className = value;
		return;
	}

	element.setAttribute(name, value);
};

XHTML1.removeAttribute = function(element, name) {
	VarType.needNode(element, 1);
	name = VarType.toStr(name);

	name = name.toLowerCase();

	if(XHTML1.isXHTML()) {
		element.removeAttributeNS(null, name);
		return;
	}

	if(name == "class") {
		element.className = "";
		return;
	}

	element.removeAttribute(name);
};

XHTML1.containsClass = function(element, className) {
	VarType.needNode(element, 1);
	className = VarType.toStr(className).replace(/^\s+/g, "").replace(/\s+$/g, "");

	var classString = XHTML1.getAttribute(element, "class").replace(/\s+/g, " ").replace(/^\s+/g, "").replace(/\s+$/g, "");
	var classArray = classString.split(" ");
	for(var i = 0; i < classArray.length; i++) {
		if(classArray[i] == className) return true;
	}

	return false;
};

XHTML1.addClass = function(element, className) {
	VarType.needNode(element, 1);
	className = VarType.toStr(className).replace(/^\s+/g, "").replace(/\s+$/g, "");

	var classString = XHTML1.getAttribute(element, "class").replace(/\s+/g, " ").replace(/^\s+/g, "").replace(/\s+$/g, "");
	var classArray = classString.split(" ");
	classString = "";
	for(var i = 0; i < classArray.length; i++) {
		if(classArray[i] != className) {
			if(classString == "") classString = classArray[i];
			else classString += " " + classArray[i];
		}
	}

	if(classString == "") classString = className;
	else classString += " " + className;

	XHTML1.setAttribute(element, "class", classString);
};

XHTML1.removeClass = function(element, className) {
	VarType.needNode(element, 1);
	className = VarType.toStr(className).replace(/^\s+/g, "").replace(/\s+$/g, "");

	var classString = XHTML1.getAttribute(element, "class").replace(/\s+/g, " ").replace(/^\s+/g, "").replace(/\s+$/g, "");
	var classArray = classString.split(" ");
	classString = "";
	for(var i = 0; i < classArray.length; i++) {
		if(classArray[i] != className) {
			if(classString == "") classString = classArray[i];
			else classString += " " + classArray[i];
		}
	}

	XHTML1.setAttribute(element, "class", classString);
};

XHTML1.removeAllChildren = function(node) {
	VarType.needNode(node);

	while(node.lastChild) {
		node.removeChild(node.lastChild);
	}
};

XHTML1.getTextContent = function(node) {
	VarType.needNode(node);

	if(typeof node.textContent != "undefined") {
		return node.textContent;
	}

	switch(node.nodeType) {
		case 1:
		case 2:
		case 5:
		case 6:
		case 11:
			var textContent = "";
			for(node = node.firstChild; node; node = node.nextSibling) {
				if(node.nodeType == 7) continue;
				if(node.nodeType == 8) continue;
				textContent += VarType.toStr(XHTML1.getTextContent(node));
			}
			return textContent;
		case 3:
		case 4:
		case 7:
		case 8:
			return node.nodeValue;
	}

	return null;
};

XHTML1.setTextContent = function(node, value) {
	VarType.needNode(node);
	value = VarType.toStr(value);

	if(typeof node.textContent != "undefined") {
		node.textContent = value;
	}

	switch(node.nodeType) {
		case 1:
		case 2:
		case 5:
		case 6:
		case 11:
			XHTML1.removeAllChildren(node);
			if(value != "") {
				node.appendChild(document.createTextNode(value));
			}
			break;
		case 3:
		case 4:
		case 7:
		case 8:
			node.nodeValue = value;
			break;
	}
};
