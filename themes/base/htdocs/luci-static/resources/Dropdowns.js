/*
Copyright (C) 2008  Alina Friedrichsen <x-alina@gmx.net>

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

function initDropdowns() {
	var aSelects = XHTML1.getElementsByTagName("select");
	var isIE6 = false /*@cc_on || @_jscript_version < 5.7 @*/;

	function showPlaceholder(sel) {
		if( ! sel._ph ) {
			var box = sel.getBoundingClientRect();
			sel._dm = sel.currentStyle.display;
			sel._ph = document.createElement('input');
			sel.parentNode.insertBefore(sel._ph, sel);
			sel._ph.style.width  = ( box.right - box.left ) + 'px';
			sel._ph.style.height = ( box.bottom - box.top ) + 'px';
			sel._ph.style.margin = sel.currentStyle.margin;
		}

		sel._ph.value = sel.options[sel.selectedIndex].text;
		sel._ph.style.display = sel._dm;
		sel.style.display = 'none';
	}

	function hidePlaceholder(sel) {
		if( sel._ph ) sel._ph.style.display = 'none';
		sel.style.display = sel._dm;
	}

	function hideSelects() {
		for(var i = 0; i < aSelects.length; i++) {
			showPlaceholder(aSelects[i]);
		}
	}

	function showSelects() {
		for(var i = 0; i < aSelects.length; i++) {
			hidePlaceholder(aSelects[i]);
		}
	}

	function onmouseover(evt) {
		XHTML1.addClass(evt.currentTarget, "over");
		if( isIE6 ) hideSelects();
	}

	function onmouseout(evt) {
		XHTML1.removeClass(evt.currentTarget, "over");
		if( isIE6 ) showSelects();
	}

	function onfocus(evt) {
		for(var element = evt.currentTarget; element; element = element.parentNode) {
			if(XHTML1.isElement(element, "li")) {
				XHTML1.addClass(element, "focus");
			}
		}
		if( isIE6 ) hideSelects();
	}

	function onblur(evt) {
		for(var element = evt.currentTarget; element; element = element.parentNode) {
			if(XHTML1.isElement(element, "li")) {
				XHTML1.removeClass(element, "focus");
			}
		}
		if( isIE6 ) showSelects();
	}

	if(document.all) {
		var liElements = XHTML1.getElementsByTagName("li");
		for(var i = 0; i < liElements.length; i++) {
			var li = liElements[i];
			for(var element = li.parentNode; element; element = element.parentNode) {
				if(XHTML1.isElement(element, "ul") && XHTML1.containsClass(element, "dropdowns")) {
					XHTML1.addEventListener(li, "mouseover", onmouseover);
					XHTML1.addEventListener(li, "mouseout", onmouseout);
					break;
				}
			}
		}
	}

	var aElements = XHTML1.getElementsByTagName("a");
	for(var i = 0; i < aElements.length; i++) {
		var a = aElements[i];
		for(var element = a.parentNode; element; element = element.parentNode) {
			if(XHTML1.isElement(element, "ul") && XHTML1.containsClass(element, "dropdowns")) {
				XHTML1.addEventListener(a, "focus", onfocus);
				XHTML1.addEventListener(a, "blur", onblur);
				break;
			}
		}
	}
}

if(XHTML1.isDOMSupported()) {
	XHTML1.addEventListener(window, "load", initDropdowns);
}
