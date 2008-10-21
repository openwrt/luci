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

function VarType() {
}

VarType.isNull = function(obj) {
	if(typeof obj == "undefined") return true;
	if(typeof obj == "object" && (!obj)) return true;
	return false;
};

VarType.toFloat = function(value) {
	value = Number(value);
	return value;
};

VarType.toDecimal = function(value) {
	value = Number(value);
	if(!isFinite(value)) value = 0.0;
	return value;
};

VarType.toInt = function(value) {
	value = Number(value);
	if(!isFinite(value)) value = 0.0;
	value = Math.floor(value);
	return value;
};

VarType.toUInt = function(value) {
	value = Number(value);
	if(!isFinite(value)) value = 0.0;
	else if(value < 0.0) value = 0.0;
	value = Math.floor(value);
	return value;
};

VarType.toStr = function(value) {
	if(VarType.isNull(value)) value = "";
	value = String(value);
	return value;
};

VarType.toBool = function(value) {
	value = Boolean(value);
	return value;
};

VarType.needObject = function(obj) {
	if(typeof obj != "object" || (!obj)) throw new TypeError();
};

VarType.needInstanceOf = function(obj, type) {
	if(!(obj instanceof type)) throw new TypeError();
};

VarType.needFunction = function(obj) {
	if(typeof obj != "function") throw new TypeError();
};

VarType.needNode = function(obj, type) {
	VarType.needObject(obj);
	if(VarType.isNull(obj.nodeType)) throw new TypeError();
	if(!VarType.isNull(type)) {
		type = VarType.toInt(type);
		if(obj.nodeType != type) throw new TypeError();
	}
};
