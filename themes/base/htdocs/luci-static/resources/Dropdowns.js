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

	function isEmptyObject(obj) {
		for(var i in obj) {
			return false;
		}
		return true;
	}

	var nextUniqueID = 1;
	var elementsNeeded = {};
	var menusShown = {};
	var menusToHide = {};
	var delayHideTimerId;
	var delayHideAllTime = 1000;
	var delayHideTime = 400;
	function delayHide() {
		for(var i in menusToHide) {
			XHTML1.removeClass(menusToHide[i], "focus");
		}
		delayHideTimerId = null;
	}

	function updatePopup() {
		if(isIE6) {
			if(isEmptyObject(elementsNeeded)) {
				showSelects();
			}
			else{
				hideSelects();
			}
		}

		var menusShownOld = menusShown;
		menusShown = {};
		for(var id in elementsNeeded) {
			var element = elementsNeeded[id];
			for(element = findLi(element); element; element = findLi(element.parentNode)) {
				XHTML1.addClass(element, "focus");
				if(!element.uniqueID) {
					element.uniqueID = nextUniqueID++;
				}
				element.style.zIndex = 1000;
				menusShown[element.uniqueID] = element;
				delete menusToHide[element.uniqueID];
			}
		}
		for(var id in menusShownOld) {
			if(!menusShown[id]) {
				if(delayHideTimerId) {
					clearTimeout(delayHideTimerId);
					delayHideTimerId = 0;
					delayHide();
				}
				menusToHide[id] = menusShownOld[id];
				menusToHide[id].style.zIndex = 999;
			}
		}
		if(menusToHide || isEmptyObject(elementsNeeded)) {
			if(delayHideTimerId) {
				clearTimeout(delayHideTimerId);
			}
			delayHideTimerId = setTimeout(delayHide, isEmptyObject(elementsNeeded) ? delayHideAllTime : delayHideTime);
		}
	}

	function findLi(element) {
		for(; element; element = element.parentNode) {
			if(XHTML1.isElement(element, "li")) {
				return element;
			}
		}
	}

	function onmouseover(evt) {
		var li = findLi(evt.currentTarget);
		if(li && !li.focused) {
			if(!li.uniqueID) {
				li.uniqueID = nextUniqueID++;
			}
			elementsNeeded[li.uniqueID] = li;
		}
		XHTML1.addClass(evt.currentTarget, "over");
		updatePopup();
	}

	function onmouseout(evt) {
		var li = findLi(evt.currentTarget);
		if(li && !li.focused && li.uniqueID) {
			delete elementsNeeded[li.uniqueID];
		}
		XHTML1.removeClass(evt.currentTarget, "over");
		updatePopup();
	}

	function onfocus(evt) {
		var li = findLi(evt.currentTarget);
		if(li) {
			li.focused = true;
			if(!li.uniqueID) {
				li.uniqueID = nextUniqueID++;
			}
			elementsNeeded[li.uniqueID] = li;
		}
		updatePopup();
	}

	function onblur(evt) {
		var li = findLi(evt.currentTarget);
		if(li) {
			li.focused = false;
			delete elementsNeeded[li.uniqueID];
		}
		updatePopup();
	}

	var aElements = XHTML1.getElementsByTagName("a");
	for(var i = 0; i < aElements.length; i++) {
		var a = aElements[i];
		for(var element = a.parentNode; element; element = element.parentNode) {
			if(XHTML1.isElement(element, "ul") && XHTML1.containsClass(element, "dropdowns")) {
				XHTML1.addEventListener(a, "focus", onfocus);
				XHTML1.addEventListener(a, "blur", onblur);
				XHTML1.addEventListener(a, "mouseover", onmouseover);
				XHTML1.addEventListener(a, "mouseout", onmouseout);
				break;
			}
		}
	}
}

if(XHTML1.isDOMSupported()) {
	XHTML1.addEventListener(window, "load", initDropdowns);
}
