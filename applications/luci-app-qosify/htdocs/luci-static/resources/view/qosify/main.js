// SPDX-License-Identifier: MIT
'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require poll';
'require rpc';
'require dom';

var UCI_PATH='/etc/config/qosify';
var RULES_PATH='/etc/qosify/00-defaults.conf';
var DSCP=['CS0','CS1','CS2','CS3','CS4','CS5','CS6','CS7','AF11','AF12','AF13','AF21','AF22','AF23','AF31','AF32','AF33','AF41','AF42','AF43','EF','VA','NQB','LE','DF'];
var OVH=['none','manual','conservative','ethernet','docsis','pppoe-ptm','bridged-ptm','pppoe-vcmux','pppoe-llcsnap','pppoa-vcmux','pppoa-llc','bridged-vcmux','bridged-llcsnap','ipoa-vcmux','ipoa-llcsnap'];
var ENCAP=['atm','noatm','ptm'];
var MODES=['diffserv3','diffserv4','diffserv8','besteffort','precedence'];
// qosify.init handles 'alias' with add_class and 'device' with add_interface,
// so those section types share the option set of class / interface.
var QAC_PANEL={defaults:'defaults','class':'class',alias:'class','interface':'interface',device:'interface'};
var SECT=[['defaults','config defaults'],['class','config class'],['alias','config alias'],['interface','config interface'],['device','config device']];

// luci.setInitAction was dropped from luci-base in 4440b267d; the rc namespace
// (built into the rpcd core binary, so no extra dependency) replaces it.
var callRcInit=rpc.declare({
	object:'rc',
	method:'init',
	params:['name','action'],
	reject:true
});
// skip_running_check keeps rc.list from forking `qosify running`, which waits
// on ubus for up to 10s while rpcd kills it after 3s.
var callRcList=rpc.declare({
	object:'rc',
	method:'list',
	params:['name','skip_running_check'],
	expect:{'':{}}
});
var callQosifyStatus=rpc.declare({
	object:'qosify',
	method:'status',
	expect:{'':{}}
});
var callServiceList=rpc.declare({
	object:'service',
	method:'list',
	params:['name'],
	expect:{'':{}}
});
var callUciRevert=rpc.declare({
	object:'uci',
	method:'revert',
	params:['config'],
	reject:true
});
function isRunning(r){
	try{var i=r.qosify.instances;for(var k in i)if(i[k].running)return true;}catch(e){}
	return false;
}

function clsLabel(c){return c.name+(c.alias?' '+_('(alias)'):'');}
function clsDesc(c){return _('Ingress: %s / Egress: %s').format(c.ingress||'',c.egress||'');}
function trim(s){return (s||'').replace(/^\s+|\s+$/g,'');}
function $(id){return document.getElementById(id);}

// ingress/egress/nat/host_isolate/autorate_ingress reach the daemon through
// qosify.init's `add_option boolean` -> json_add_boolean -> !!atoi(), so only a
// non-zero number is true: 'true', 'on' and 'yes' all mean off.
function numBool(v,def){
	if(v==null||v==='')return !!def;
	var n=parseInt(v,10);
	return !isNaN(n)&&n!==0;
}
// `disabled` is read with config_get_bool, which does accept the word forms.
function uciBool(v,def){
	if(v==null||v==='')return !!def;
	switch(String(v).toLowerCase()){
	case '1':case 'on':case 'true':case 'yes':case 'enabled':return true;
	case '0':case 'off':case 'false':case 'no':case 'disabled':return false;
	}
	return !!def;
}
function boolNum(v){return /^-?\d+$/.test(String(v==null?'':v));}

// ubus call qosify status -> { devices:{}, interfaces:{ <name>:{ active,... } } }
function statusActive(st){
	var groups=['interfaces','devices'],i,k,t;
	for(i=0;i<groups.length;i++){
		t=st&&st[groups[i]];
		for(k in t)if(t[k]&&t[k].active)return true;
	}
	return false;
}
function statusCount(st){
	var groups=['interfaces','devices'],i,k,t,n=0;
	for(i=0;i<groups.length;i++){
		t=st&&st[groups[i]];
		for(k in t)if(t[k]&&t[k].active)n++;
	}
	return n;
}

function countRules(text){
	var n=0,lines=(text||'').split('\n');
	for(var i=0;i<lines.length;i++){
		var l=lines[i],h=l.indexOf('#');
		if(h>=0)l=l.slice(0,h);
		if(trim(l))n++;
	}
	return n;
}

function validateRules(d){
	if(/\x00/.test(d))return _('Binary content rejected');
	var lines=d.split('\n');
	for(var i=0;i<lines.length;i++){
		var l=lines[i],h=l.indexOf('#');
		if(h>=0)l=l.slice(0,h);
		l=trim(l);
		if(l.length>1023)return _('Line %d is longer than 1023 characters — the rule loader reads fixed-size lines and would split it').format(i+1);
	}
	return null;
}
function fmtSize(n){return n<1024?n+'B':(n/1024).toFixed(1)+'K';}
function fmtMtime(t){if(!t)return '';return new Date(t*1000).toLocaleString();}

// The shaping section Quick Settings edits, or null. Prefers the first enabled
// section, and accepts `config device` since qosify.init feeds both section
// types through add_interface(). An anonymous section has a synthetic .name
// (cfgXXXXXX / newXXXXXX) that never appears in the file, so name is left empty
// for it and setOpts() locates the block by per-type ordinal instead.
function ifSect(){
	var a=[];
	['interface','device'].forEach(function(t){
		var i=0;
		uci.sections('qosify',t,function(s){
			a.push({type:t,id:s['.name'],name:s['.anonymous']?'':s['.name'],idx:i++,on:!uciBool(s.disabled,false)});
		});
	});
	for(var j=0;j<a.length;j++)if(a[j].on)return a[j];
	return a.length?a[0]:null;
}
// --- Mirrors qosify.init add_interface() and cmd_add_qdisc() in interface.c ---
// nat defaults to 1 for interfaces and 0 for devices; host_isolate defaults on.
function ifCfg(s,dev){
	return {
		bw_up:s.bandwidth_up||s.bandwidth||'',
		bw_dn:s.bandwidth_down||s.bandwidth||'',
		mode:s.mode||'diffserv4',
		ingress:numBool(s.ingress,true),
		egress:numBool(s.egress,true),
		host_isolate:numBool(s.host_isolate,true),
		autorate:numBool(s.autorate_ingress,false),
		nat:numBool(s.nat,!dev)
	};
}
function hasNat(v){return /(^|\s)nat(\s|$)/.test(v||'');}
// Keys the daemon will silently drop, given the rest of the section.
function ifLint(s,dev){
	var w=[],c=ifCfg(s,dev);
	if(!s.name)w.push(_('name is not set — qosify.init sends an empty device name and this section is never applied'));
	if(!c.host_isolate&&c.nat){
		var ne=hasNat(s.options)||hasNat(s.egress_options);
		var ni=hasNat(s.options)||hasNat(s.ingress_options);
		if(!ne&&!ni)w.push(_('nat is not sent: qosify only emits nat/nonat inside the host_isolate branch. CAKE does accept flows plus nat — put nat in options to apply it'));
		else if(!ne||!ni)w.push(_('nat only reaches %s — put it in options, or in both ingress_options and egress_options').format(ne?'egress':'ingress'));
	}
	if(s.overhead_type!=='manual'&&(s.overhead||s.overhead_encap))w.push(_('overhead and overhead_encap are ignored unless overhead_type is manual'));
	if(!c.ingress&&!c.egress)w.push(_('ingress and egress are both 0 — nothing is shaped'));
	if(c.egress&&!c.bw_up)w.push(_('no bandwidth_up or bandwidth — egress CAKE runs unlimited'));
	if(c.ingress&&!c.bw_dn)w.push(_('no bandwidth_down or bandwidth — ingress CAKE runs unlimited'));
	['ingress','egress','nat','host_isolate','autorate_ingress'].forEach(function(k){
		if(s[k]!=null&&s[k]!==''&&!boolNum(s[k]))w.push(_('%s is set to "%s" — qosify converts it with atoi(), so anything but a non-zero number means off').format(k,s[k]));
	});
	if(s.disabled!=null&&s.disabled!==''&&!/^(0|1|on|off|true|false|yes|no|enabled|disabled)$/i.test(String(s.disabled)))
		w.push(_('disabled is set to "%s" — config_get_bool does not recognise that, so the section stays enabled').format(s.disabled));
	['bandwidth_up','bandwidth_down','bandwidth','mode','ingress_options','egress_options','options'].forEach(function(k){
		if(s[k]&&/['"`$;&|<>(){}\\]/.test(String(s[k])))w.push(_('%s contains shell metacharacters — qosify assembles the tc command as a string and runs it with sh -c, so the command will break or execute them').format(k));
	});
	return w;
}
// Locate config blocks in raw UCI text: {type,name,start,end} (end = last non-blank
// line). Headers may be bare, single- or double-quoted — all three are valid UCI —
// and uci ends a token at # and treats ; as a statement separator, so a trailing
// comment or `config x; option y z` is a header too.
function unq(s){return String(s||'').replace(/^["']|["']$/g,'');}
function cfgSections(txt){
	var out=[],cur=null,lines=(txt||'').split('\n');
	for(var i=0;i<lines.length;i++){
		var head=lines[i].replace(/#.*$/,'').split(';')[0];
		var m=/^\s*config\s+(\S+)(?:\s+(\S+))?\s*$/.exec(head);
		if(m){cur={type:unq(m[1]),name:unq(m[2]),start:i,end:i};out.push(cur);}
		else if(cur&&trim(lines[i])!=='')cur.end=i;
	}
	return out;
}
// Values are spliced into a single-quoted UCI string: strip quotes and line breaks,
// or a stray newline injects arbitrary option/config lines into the file.
function qv(v){return v==null?'':String(v).replace(/['"\r\n]/g,'');}
// Set/remove options inside one config block, preserving every other byte of the
// file (comments, ordering, lists, unknown options). kv[key]===null deletes.
// idx = ordinal among sections of this type, used when name is empty (anonymous).
function setOpts(txt,type,name,idx,kv){
	var lines=(txt||'').split('\n'),secs=cfgSections(txt),s=null,n=0,i,k;
	for(i=0;i<secs.length;i++){
		if(secs[i].type!==type)continue;
		if(name?secs[i].name===name:n++===idx){s=secs[i];break;}
	}
	if(!s){
		var blk=["config "+type+(name?" '"+name+"'":'')];
		for(k in kv)if(kv[k]!=null)blk.push("\toption "+k+" '"+qv(kv[k])+"'");
		var t=(txt||'').replace(/\s+$/,'');
		return (t?t+'\n\n':'')+blk.join('\n')+'\n';
	}
	var out=[lines[s.start]],seen={};
	for(i=s.start+1;i<=s.end;i++){
		var lm=/^\s*list\s+(\S+)(\s|$)/.exec(lines[i]);
		if(lm&&(lm[1] in kv))throw new Error(_('%s is a list in this section — edit %s directly').format(lm[1],UCI_PATH));
		var m=/^\s*option\s+(\S+)\s+(.*)$/.exec(lines[i]);
		if(m&&(m[1] in kv)){
			seen[m[1]]=1;
			if(kv[m[1]]!=null)out.push("\toption "+m[1]+" '"+qv(kv[m[1]])+"'");
			continue;
		}
		out.push(lines[i]);
	}
	for(k in kv)if(!seen[k]&&kv[k]!=null)out.push("\toption "+k+" '"+qv(kv[k])+"'");
	return lines.slice(0,s.start).concat(out,lines.slice(s.end+1)).join('\n');
}
// Non-blocking sanity pass: flag rule targets that are neither a defined class,
// a DSCP codepoint, nor a raw numeric value.
// __qosify_map_dscp_value() parses raw values with strtoul(base 0), so a leading
// zero means octal: 077 is 63 and valid, 08 is not a number at all.
function dscpNum(v){
	if(/^0[xX][0-9a-fA-F]+$/.test(v))return parseInt(v,16);
	if(/^0[0-7]+$/.test(v))return parseInt(v,8);
	if(/^(0|[1-9]\d*)$/.test(v))return parseInt(v,10);
	return null;
}
function ruleWarn(txt,names){
	var w=[],bad=[],bare=[],lines=(txt||'').split('\n');
	for(var i=0;i<lines.length;i++){
		var l=lines[i],h=l.indexOf('#');
		if(h>=0)l=l.slice(0,h);
		l=trim(l);if(!l)continue;
		var f=l.split(/\s+/);
		if(f.length<2){if(bare.length<5)bare.push(String(i+1));continue;}
		var v=f[1].replace(/^\+/,'');
		if(names.indexOf(v)>=0||DSCP.indexOf(v)>=0)continue;
		var n=dscpNum(v);
		if(n!==null&&n<64)continue;
		if(bad.indexOf(v)<0)bad.push(v);
	}
	if(bare.length)w.push(_('No DSCP target on line %s — qosify skips single-field lines').format(bare.join(', ')));
	if(bad.length)w.push(_('Unknown class/DSCP target: %s').format(bad.slice(0,5).join(', ')));
	return w;
}

var noteSeen={};
function notify(msg,kind){
	var key=String(msg);
	if(noteSeen[key])return null;
	var n=ui.addNotification(null,E('p',{},msg),kind||'info');
	if(!n)return null;
	noteSeen[key]=1;
	var ms=(kind==='danger')?10000:(kind==='warning')?8000:5000;
	setTimeout(function(){
		delete noteSeen[key];
		if(n&&n.parentNode)n.parentNode.removeChild(n);
	},ms);
	return n;
}

// Remember the size/mtime an editor was loaded from, so a save can tell the
// difference between "the user changed this" and "something else changed the
// file underneath us".
function noClassRow(){
	return E('tr',{},E('td',{'colspan':2,'class':'qos-muted'},E('em',{},_('No classes defined in %s').format(UCI_PATH))));
}

function stampFile(el,st){
	el.dataset.mtime=st?String(st.mtime):'';
	el.dataset.size=st?String(st.size):'';
}
function fileMoved(el,st){
	if(!el||el.dataset.mtime==null)return false;
	var m=st?String(st.mtime):'',z=st?String(st.size):'';
	return el.dataset.mtime!==m||el.dataset.size!==z;
}

function confirmDialog(title,text,label,negative){
	return new Promise(function(resolve){
		var done=function(v){ui.hideModal();resolve(v);};
		ui.showModal(title,[
			E('p',{},text),
			E('div',{'class':'right'},[
				E('button',{'class':'cbi-button','click':function(){done(false);}},_('Cancel')),
				' ',
				E('button',{'class':'cbi-button '+(negative?'cbi-button-negative':'cbi-button-action'),'click':function(){done(true);}},label||_('Continue'))
			])
		]);
	});
}

return view.extend({
	handleSaveApply:null,handleSave:null,handleReset:null,
	currentTab:'ov',
	readonly:false,

	load:function(){
		return Promise.all([
			uci.load('qosify').catch(function(){return null;}),
			this.gatherCtx(true)
		]);
	},

	render:function(d){
		var self=this,ctx=d[1];

		this.readonly=!L.hasViewPermission();

		if(d[0]===null)notify(_('The qosify UCI configuration could not be loaded — class and interface lists may be incomplete.'),'warning');

		var root=E('div',{'class':'cbi-map','id':'qos-app'});
		root.appendChild(E('link',{'rel':'stylesheet','href':L.resource('view/qosify/qosify.css')}));
		root.appendChild(E('h2',{},_('qosify')));
		root.appendChild(E('div',{'class':'cbi-map-descr'},_('Traffic shaping and DSCP classification via qosify')));

		var names={ov:'overview',cf:'config',ru:'rules',ad:'advanced',st:'status'};
		var hash=(location.hash||'').slice(1),want='ov',k;
		for(k in names)if(names[k]===hash)want=k;

		var group=E('div',{});
		[['ov',_('Overview'),this.tabOverview(ctx)],
		 ['cf',_('Config'),this.tabConfig(ctx)],
		 ['ru',_('Classification Rules'),this.tabRules(ctx)],
		 ['ad',_('Advanced'),this.tabAdvanced(ctx)],
		 ['st',_('Status'),this.tabStatus(ctx)]].forEach(function(t){
			var pane=t[2];
			pane.setAttribute('data-tab',t[0]);
			pane.setAttribute('data-tab-title',t[1]);
			if(t[0]===want)pane.setAttribute('data-tab-active','true');
			pane.addEventListener('cbi-tab-active',function(){
				self.currentTab=t[0];
				try{history.replaceState(null,'','#'+names[t[0]]);}catch(e){}
				// The Status tab costs a fork per active interface, so it is fetched
				// when it is opened rather than on every page load; initTabGroup fires
				// this from a requestAnimationFrame, so the pane is in the DOM.
				if(t[0]==='st')self.refreshStatus();
			});
			group.appendChild(pane);
		});
		root.appendChild(group);
		ui.tabs.initTabGroup(group.childNodes);
		this.currentTab=want;

		if(this.readonly){
			this.applyReadonly(root);
			notify(_('You have read-only access to this page, so editing and service control are disabled.'),'warning');
		}

		this.installPollers();
		return root;
	},

	// Both tabs tick at 10 s. Overview is five ubus calls and no forks; the Status
	// tab forks qosify-status, which runs tc twice per active interface, so it is
	// the expensive one and does not get a faster tick. Poll.step() holds
	// the next tick until the promise this returns settles, and refreshStatus()
	// drops an overlapping call, so a fork slower than the interval skips ticks
	// instead of stacking up.
	installPollers:function(){
		var self=this;
		poll.add(function(){if(self.currentTab!=='ov'||self._n)return;return self.refreshOverview();},10);
		poll.add(function(){if(self.currentTab!=='st'||self._n)return;return self.refreshStatus();},10);
	},

	tabOverview:function(ctx){
		var section=E('div',{'id':'qos-ov'});
		section.appendChild(E('fieldset',{'class':'cbi-section','id':'qos-svc-sect'},this.buildSvcSect(ctx)));
		section.appendChild(E('fieldset',{'class':'cbi-section','id':'qos-qs-sect'},this.buildQsSect(ctx)));
		section.appendChild(E('fieldset',{'class':'cbi-section','id':'qos-cfg-sect'},this.buildCfgSect(ctx)));
		section.appendChild(E('fieldset',{'class':'cbi-section','id':'qos-ctl-sect'},this.buildCtlSect(ctx)));
		return section;
	},

	buildSvcSect:function(ctx){
		return [E('legend',{},_('Service Status')),this.renderSvcTable(ctx)];
	},

	buildCfgSect:function(ctx){
		return [E('legend',{},_('Configuration Files')),this.renderCfgFiles(ctx)];
	},

	buildQsSect:function(ctx){
		var self=this;
		var sn=ifSect();
		var w=(sn&&uci.get('qosify',sn.id))||{};
		var enChecked=(w['.name']!=null&&!uciBool(w.disabled,false));

		var nodes=[];
		nodes.push(E('legend',{},_('Quick Settings')));
		nodes.push(E('div',{'class':'cbi-section-descr'},
			_('Common shaping settings — written straight to %s, section %s.').format(UCI_PATH,sn?'config '+sn.type+(sn.name?" '"+sn.name+"'":' '+_('(unnamed section)')):"config interface 'wan' (will be created)")));
		var tbl=E('table',{'class':'qos-kv','width':'100%'});
		var bdy=E('tbody');tbl.appendChild(bdy);

		function row(lbl,el){
			var n=(el&&el.nodeType)?el:(Array.isArray(el)?el[0]:null);
			var id=(n&&n.id)||null;
			bdy.appendChild(E('tr',{},[E('td',{},id?E('label',{'for':id},lbl):lbl),E('td',{},el)]));
		}
		function chk(name,val){return E('input',{'type':'checkbox','id':'q-'+name,'data-q':name,'checked':val?'checked':null});}
		function txt(name,val,ph,style){return E('input',{'type':'text','id':'q-'+name,'data-q':name,'value':val||'','placeholder':ph||'','style':style||'width:140px;font-family:monospace'});}
		function sel(name,val,opts,style,def,hint){
			val=qv(val);
			var s=E('select',{'id':'q-'+name,'data-q':name,'style':style||'width:180px'});
			if(!def)s.appendChild(E('option',{'value':''},hint?'-- ('+hint+')':'--'));
			var sv=val||def||'',known=false;
			opts.forEach(function(o){var a={'value':o};if(sv===o){a.selected='selected';known=true;}s.appendChild(E('option',a,o));});
			if(val&&!known)s.appendChild(E('option',{'value':val,'selected':'selected'},_('%s (current)').format(val)));
			return s;
		}

		var enCb=chk('enabled',enChecked);
		var enBadge=E('span',{'class':'qos-badge qos-amber','style':'margin-left:8px','id':'q-en-badge'},'');
		this.updateEnBadge(enBadge,ctx,enChecked);
		row(_('QoS Enabled'),[enCb,enBadge]);
		// qosify.init passes `option name` to add_interface(); without it the daemon
		// gets an empty device and the section is never applied, so offer it here
		// whenever it is missing -- anonymous sections have no other way to set it.
		// Only `config interface` is named after the netifd interface; a `config
		// device` section names a netdev and the two differ by convention -- the
		// shipped config has `config device wandev` with `option name wan` -- so the
		// section name is never a safe prefill there. Leave it empty and let ifLint()
		// keep warning until a real netdev is entered.
		var isDev=!!(sn&&sn.type==='device');
		if(!w.name)row(isDev?_('Netdev Name'):_('Interface Name'),
			[txt('name',sn?(isDev?'':sn.name):'wan',_('e.g. %s').format(isDev?'eth0':'wan'),'width:140px'),
			E('span',{'style':'opacity:.6;font-size:11px;margin-left:8px'},_('required — qosify skips sections with no name'))]);
		row(_('Bandwidth Up'),txt('bw_up',w.bandwidth_up,_('e.g. %s').format('100mbit')));
		row(_('Bandwidth Down'),txt('bw_down',w.bandwidth_down,_('e.g. %s').format('100mbit')));
		row(_('Overhead Type'),sel('overhead',w.overhead_type,OVH,'width:180px','none'));
		row(_('Overhead Bytes'),[txt('overhead_b',w.overhead,_('manual only'),'width:100px'),
			E('span',{'style':'opacity:.6;font-size:11px;margin-left:8px'},_('used only when Overhead Type is manual'))]);
		row(_('Queue Mode'),sel('mode',w.mode,MODES,'width:170px',null,'diffserv4'));
		row(_('Ingress'),chk('ingress',numBool(w.ingress,true)));
		row(_('Egress'),chk('egress',numBool(w.egress,true)));
		// CAKE is only given nat/nonat when host_isolate is on; otherwise it gets
		// flow isolation and nat has no effect at all.
		var natCb=chk('nat',numBool(w.nat,!isDev));
		var hiCb=chk('host_isolate',numBool(w.host_isolate,true));
		var natNote=E('span',{'style':'opacity:.65;font-size:11px;margin-left:8px'},
			_('qosify only passes this to CAKE together with Host Isolate — add nat to Options to force it'));
		function syncNat(){
			natNote.style.display=hiCb.checked?'none':'';
		}
		hiCb.addEventListener('change',syncNat);
		syncNat();
		row(_('NAT'),[natCb,natNote]);
		row(_('Host Isolate'),hiCb);
		row(_('Autorate Ingress'),chk('autorate',numBool(w.autorate_ingress,false)));
		row(_('Ingress Options'),txt('ing_opts',w.ingress_options,_('e.g. %s').format('triple-isolate memlimit 32mb'),'width:100%;max-width:400px;font-family:monospace'));
		row(_('Egress Options'),txt('egr_opts',w.egress_options,_('e.g. %s').format('triple-isolate memlimit 32mb wash'),'width:100%;max-width:400px;font-family:monospace'));
		row(_('Options'),txt('opts',w.options,_('e.g. %s').format('overhead 44 mpu 84'),'width:100%;max-width:400px;font-family:monospace'));
		nodes.push(tbl);
		nodes.push(E('div',{'class':'cbi-page-actions'},
			E('button',{'class':'cbi-button cbi-button-apply','click':function(){return self.saveQuick();}},_('Save & Apply'))));
		return nodes;
	},

	buildCtlSect:function(ctx){
		var self=this;
		var nodes=[E('legend',{},_('Service Controls'))];
		var svcCt=E('div',{'class':'qos-svc','id':'qos-svc-btns'});
		svcCt.appendChild(E('button',{
			'class':'cbi-button '+(ctx.enabled?'cbi-button-positive':'cbi-button-negative'),
			'id':'qos-btn-auto',
			'title':ctx.enabled?_('Click to disable autostart'):_('Click to enable autostart'),
			'click':function(){return self.svcAction(ctx.enabled?'disable':'enable');}
		},ctx.enabled?_('Enabled'):_('Disabled')));
		var btnCls={start:'cbi-button-apply',stop:'cbi-button-negative',restart:'cbi-button-action',reload:'cbi-button-reload'};
		['start','stop','restart','reload'].forEach(function(a){
			svcCt.appendChild(E('button',{
				'class':'cbi-button '+btnCls[a],
				'click':function(){return self.svcAction(a);}
			},({start:_('Start'),stop:_('Stop'),restart:_('Restart'),reload:_('Reload')})[a]));
		});
		nodes.push(svcCt);
		return nodes;
	},

	fillSect:function(id,nodes){
		var el=$(id);
		if(!el)return;
		dom.content(el,'');
		nodes.forEach(function(n){el.appendChild(n);});
		this.applyReadonly(el);
	},

	applyReadonly:function(el){
		if(!this.readonly||!el)return;
		el.querySelectorAll('input,select,textarea,button').forEach(function(x){
			if(!x.getAttribute('data-ro-ok'))x.setAttribute('disabled','');
		});
	},

	waitForRunning:function(timeoutMs){
		var deadline=Date.now()+(timeoutMs||3000);
		function tick(){
			return L.resolveDefault(callServiceList('qosify'),{}).then(function(r){
				if(isRunning(r))return true;
				if(Date.now()>=deadline)return false;
				return new Promise(function(res){setTimeout(res,400);}).then(tick);
			});
		}
		return tick();
	},

	waitForStopped:function(timeoutMs){
		var deadline=Date.now()+(timeoutMs||3000);
		function tick(){
			return L.resolveDefault(callServiceList('qosify'),{}).then(function(r){
				if(!isRunning(r))return true;
				if(Date.now()>=deadline)return false;
				return new Promise(function(res){setTimeout(res,400);}).then(tick);
			});
		}
		return tick();
	},

	applyService:function(){
		var self=this;
		return L.resolveDefault(callServiceList('qosify'),{}).then(function(r){
			if(isRunning(r))return callRcInit('qosify','reload');
			return callRcInit('qosify','start').then(function(){
				return self.waitForRunning(4000);
			}).then(function(up){
				if(!up)throw new Error(_('qosify did not come up — check the system log'));
			});
		});
	},

	updateEnBadge:function(el,ctx,enChecked){
		dom.content(el,'');
		if(ctx.active){el.className='qos-badge qos-green';dom.append(el,_('Active'));}
		else if(ctx.running&&enChecked){el.className='qos-badge qos-amber';dom.append(el,_('Enabled — Not Shaping (check config)'));}
		else if(enChecked){el.className='qos-badge qos-amber';dom.append(el,_('Enabled — Not Running'));}
		else{el.className='qos-badge qos-red';dom.append(el,_('Disabled'));}
	},

	svcNodes:function(ctx){
		function ok(t){return E('span',{'class':'qos-ok'},'\u2714 '+t);}
		function err(t){return E('span',{'class':'qos-err'},'\u2718 '+t);}
		function bdg(cls,t){return E('span',{'class':'qos-badge '+cls},t);}
		var run;
		if(ctx.running&&ctx.active)run=bdg('qos-green',_('Running & Shaping'));
		else if(ctx.running)run=bdg('qos-amber',_('Running — Not Shaping'));
		else run=bdg('qos-red',_('Not Running'));
		return {
			init:ctx.hasInit?ok(_('Available')):err(_('Missing')),
			auto:bdg(ctx.enabled?'qos-green':'qos-red',ctx.enabled?_('Enabled'):_('Disabled')),
			run:run,
			shaped:ctx.shaped?E('span',{},N_(ctx.shaped,'%d interface','%d interfaces').format(ctx.shaped)):E('span',{'class':'qos-muted'},_('none'))
		};
	},

	renderSvcTable:function(ctx){
		var n=this.svcNodes(ctx);
		var tbl=E('table',{'class':'qos-kv','width':'100%','id':'qos-svc-tbl'});
		var b=E('tbody');tbl.appendChild(b);
		b.appendChild(E('tr',{},[E('td',{},_('Init Script')),E('td',{'id':'qos-svc-init'},n.init)]));
		b.appendChild(E('tr',{},[E('td',{},_('Autostart')),E('td',{'id':'qos-svc-auto'},n.auto)]));
		b.appendChild(E('tr',{},[E('td',{},_('Running')),E('td',{'id':'qos-svc-run'},n.run)]));
		b.appendChild(E('tr',{},[E('td',{},_('Shaping')),E('td',{'id':'qos-svc-shaped'},n.shaped)]));
		return tbl;
	},

	updateSvcTable:function(ctx){
		var n=this.svcNodes(ctx),map={init:'qos-svc-init',auto:'qos-svc-auto',run:'qos-svc-run',shaped:'qos-svc-shaped'},k,el;
		for(k in map){el=$(map[k]);if(el)dom.content(el,n[k]);}
		el=$('qos-btn-auto');
		if(el){
			el.className='cbi-button '+(ctx.enabled?'cbi-button-positive':'cbi-button-negative');
			el.title=ctx.enabled?_('Click to disable autostart'):_('Click to enable autostart');
			dom.content(el,ctx.enabled?_('Enabled'):_('Disabled'));
		}
	},

	renderCfgFiles:function(ctx){
		var rulesN=(ctx.rulesN!=null)?ctx.rulesN:countRules(ctx.rulesText);
		var cfgOk=(ctx.cfgOk!=null)?ctx.cfgOk:((ctx.cfgRaw||'').length>10&&/(^|\n)config /.test(ctx.cfgRaw||''));
		var rulesOk=rulesN>0;
		var tbl=E('table',{'class':'qos-kv','width':'100%'});
		var b=E('tbody');tbl.appendChild(b);
		function fileRow(path,exists,ok,sz,mod,extra){
			var st;
			if(ok)st=E('span',{'class':'qos-ok'},'\u2714 '+_('Valid'));
			else if(exists)st=E('span',{'class':'qos-warn'},'\u26a0 '+_('Found (empty or invalid)'));
			else st=E('span',{'class':'qos-err'},'\u2718 '+_('Missing'));
			var meta=exists?E('span',{'style':'opacity:.7;margin-left:8px;font-size:12px'},'('+(extra||'')+fmtSize(sz)+', '+mod+')'):'';
			b.appendChild(E('tr',{},[E('td',{},path),E('td',{},[st,meta])]));
		}
		fileRow(UCI_PATH,!!ctx.cfgStat,cfgOk,ctx.cfgStat?ctx.cfgStat.size:0,ctx.cfgStat?fmtMtime(ctx.cfgStat.mtime):'');
		fileRow(RULES_PATH,!!ctx.rulesStat,rulesOk,ctx.rulesStat?ctx.rulesStat.size:0,ctx.rulesStat?fmtMtime(ctx.rulesStat.mtime):'',N_(rulesN,'%d rule','%d rules').format(rulesN)+', ');
		return tbl;
	},

	tabConfig:function(ctx){
		var self=this;
		var section=E('div',{'id':'qos-cf'});
		var fs1=E('fieldset',{'class':'cbi-section'},[
			E('legend',{},_('Config')),
			E('div',{'class':'cbi-section-descr'},[_('UCI configuration — classes, interfaces, defaults.')+' ',E('code',{},UCI_PATH)])
		]);

		// Quick Add Config — built first so the reference table can be derived from it
		var classes=this.getClasses();
		var dscpChoices=classes.map(function(c){return c.name;}).concat(DSCP);
		var qa=E('div',{'class':'qos-qa'});
		qa.appendChild(E('strong',{},_('Quick Add Config')));
		var qacRow=E('div',{'class':'qos-qa-row'});
		var qacType=E('select',{'id':'qac-type','style':'width:130px','change':function(){self.qacSwitch();}});
		SECT.forEach(function(o){qacType.appendChild(E('option',{'value':o[0]},o[1]));});
		qacRow.appendChild(qacType);
		qacRow.appendChild(E('span',{'id':'qac-nm-w','style':'display:none'},
			E('input',{'id':'qac-name','type':'text','placeholder':_('section name'),'style':'width:120px;font-family:monospace'})));
		qacRow.appendChild(E('button',{'class':'cbi-button cbi-button-add','click':function(){return self.qacAdd();}},_('Add')));
		qa.appendChild(qacRow);

		// config defaults — add_defaults() in qosify.init
		var qadDef=E('div',{'class':'qos-qa-row','id':'qac-opts-defaults'});
		this.qaInput(qadDef,'defaults','list','/etc/qosify/*.conf',180);
		this.qaNum(qadDef,'timeout','300',60);
		this.qaSelect(qadDef,'dscp_default_tcp',dscpChoices,140);
		this.qaSelect(qadDef,'dscp_default_udp',dscpChoices,140);
		this.qaSelect(qadDef,'dscp_icmp',dscpChoices,140);
		this.qaSelect(qadDef,'dscp_prio',dscpChoices,140);
		this.qaSelect(qadDef,'dscp_bulk',dscpChoices,140);
		this.qaNum(qadDef,'prio_max_avg_pkt_len','500',55);
		this.qaNum(qadDef,'bulk_trigger_pps','100',55);
		this.qaNum(qadDef,'bulk_trigger_timeout','5',45);
		qa.appendChild(qadDef);

		// config class / config alias — add_class()
		var qadCls=E('div',{'class':'qos-qa-row','id':'qac-opts-class','style':'display:none'});
		this.qaSelect(qadCls,'value',DSCP,70);
		this.qaSelect(qadCls,'ingress',DSCP,70);
		this.qaSelect(qadCls,'egress',DSCP,70);
		this.qaSelect(qadCls,'dscp_prio',dscpChoices,140);
		this.qaSelect(qadCls,'dscp_bulk',dscpChoices,140);
		this.qaNum(qadCls,'prio_max_avg_pkt_len','500',55);
		this.qaNum(qadCls,'bulk_trigger_pps','100',55);
		this.qaNum(qadCls,'bulk_trigger_timeout','5',45);
		qa.appendChild(qadCls);

		// config interface / config device — add_interface()
		var qadIf=E('div',{'class':'qos-qa-row','id':'qac-opts-interface','style':'display:none'});
		this.qaInput(qadIf,'name','option','wan',80);
		this.qaSelect(qadIf,'disabled',['0','1'],45);
		this.qaInput(qadIf,'bandwidth_up','option','100mbit',80);
		this.qaInput(qadIf,'bandwidth_down','option','100mbit',80);
		this.qaInput(qadIf,'bandwidth','option','100mbit',80);
		this.qaSelect(qadIf,'mode',MODES,100);
		this.qaSelect(qadIf,'ingress',['0','1'],45);
		this.qaSelect(qadIf,'egress',['0','1'],45);
		this.qaSelect(qadIf,'nat',['0','1'],45);
		this.qaSelect(qadIf,'host_isolate',['0','1'],45);
		this.qaSelect(qadIf,'autorate_ingress',['0','1'],45);
		this.qaSelect(qadIf,'overhead_type',OVH,130);
		this.qaNum(qadIf,'overhead','44',55);
		this.qaSelect(qadIf,'overhead_encap',ENCAP,70);
		this.qaNum(qadIf,'overhead_mpu','84',55);
		this.qaSelect(qadIf,'overhead_vlan',['0','1','2'],45);
		this.qaInput(qadIf,'ingress_options','option','triple-isolate',160);
		this.qaInput(qadIf,'egress_options','option','triple-isolate wash',160);
		this.qaInput(qadIf,'options','option','overhead 44 mpu 84',160);
		qa.appendChild(qadIf);

		// Reference panel — option lists read back out of the panels above, so the
		// reference and the Quick Add dropdown can never disagree.
		var ref=E('details',{'class':'qos-ref'});
		ref.appendChild(E('summary',{},_('Config Reference')));
		ref.appendChild(this.refTable({defaults:qadDef,'class':qadCls,'interface':qadIf}));
		var defBox=E('div',{'id':'qos-cfg-def','class':'qos-item'});
		dom.content(defBox,this.defsNodes());
		ref.appendChild(defBox);
		var clsBox=E('div',{'id':'qos-cfg-cls'});
		classes.forEach(function(c){
			clsBox.appendChild(self.clsBoxNode(c));
		});
		ref.appendChild(clsBox);
		ref.appendChild(E('div',{'class':'qos-muted','style':'margin:4px 0 2px'},
			_('DSCP codepoints: CS0–CS7, AF11–AF43, EF, VA, NQB, LE, DF. Any dscp_* value may also name a class. Prefix with + to override only when the DSCP field is zero.')));
		ref.appendChild(E('div',{'class':'qos-muted','style':'margin:2px 0'},
			_('Defaults qosify applies when a key is absent — interface: mode diffserv4, ingress 1, egress 1, nat 1, host_isolate 1, autorate_ingress 0. device: identical except nat 0. defaults: timeout 3600, dscp_default_tcp/udp CS0, dscp_prio/dscp_bulk/dscp_icmp unset, bulk_trigger_pps/bulk_trigger_timeout/prio_max_avg_pkt_len 0 (disabled).')));
		fs1.appendChild(ref);
		fs1.appendChild(qa);

		// Editor
		var ta=E('textarea',{
			'id':'qos-config-ta',
			'class':'qos-edit',
			'rows':28,
			'style':'line-height:1.4;tab-size:4;padding:6px'
		},ctx.cfgRaw||'');
		ta.dataset.orig=ctx.cfgRaw||'';
		stampFile(ta,ctx.cfgStat);
		fs1.appendChild(ta);
		fs1.appendChild(E('div',{'class':'cbi-page-actions'},[
			E('button',{'class':'cbi-button cbi-button-reset','style':'margin-right:6px','click':function(){return self.clearCfg();}},_('Clear')),
			E('button',{'class':'cbi-button cbi-button-apply','click':function(){return self.saveConfig();}},_('Save & Apply'))
		]));

		section.appendChild(fs1);
		return section;
	},

	clsBoxNode:function(c){
		return E('div',{'class':'qos-item'},[
			E('strong',{},clsLabel(c)),
			E('span',{'class':'qos-muted','style':'margin-left:8px'},clsDesc(c))
		]);
	},

	refTable:function(panels){
		var note={
			'class':_('Section name is the class name that rules and dscp_* values refer to. value sets ingress and egress together.'),
			alias:_('Same options as class — gives an existing class a second name.'),
			'interface':_('name is the netifd interface. bandwidth applies only where bandwidth_up/bandwidth_down are unset. overhead and overhead_encap apply only when overhead_type is manual.'),
			device:_('Same options as interface, but name is a netdev. nat defaults to 0 here and to 1 for interfaces.')
		};
		var tbl=E('table',{'class':'qos-kv','width':'100%','style':'margin:6px 0'});
		var b=E('tbody');tbl.appendChild(b);
		SECT.forEach(function(o){
			var div=panels[QAC_PANEL[o[0]]],els=div?div.querySelectorAll('[data-opt]'):[],out=[];
			for(var i=0;i<els.length;i++)
				out.push((els[i].getAttribute('data-pre')==='list'?'list ':'option ')+els[i].getAttribute('data-opt'));
			b.appendChild(E('tr',{},[
				E('td',{'style':'width:135px;font-family:monospace;vertical-align:top'},o[1]),
				E('td',{},[
					E('div',{'style':'font-family:monospace;font-size:11px;line-height:1.6'},out.join(', ')),
					note[o[0]]?E('div',{'class':'qos-muted','style':'margin-top:3px'},note[o[0]]):''
				])
			]));
		});
		return tbl;
	},

	qaId:function(parent,opt){return (parent.id||'qac')+'-'+opt;},
	qaInput:function(parent,opt,pre,ph,w){
		var id=this.qaId(parent,opt);
		parent.appendChild(E('label',{'for':id},opt+':'));
		parent.appendChild(E('input',{
			'id':id,'data-opt':opt,'data-pre':pre,'type':'text',
			'value':pre==='list'?ph:'','placeholder':pre==='list'?'':ph,
			'style':'width:'+w+'px;font-family:monospace'
		}));
	},
	qaSelect:function(parent,opt,opts,w,required){
		var id=this.qaId(parent,opt);
		parent.appendChild(E('label',{'for':id},opt+':'));
		var s=E('select',{'id':id,'data-opt':opt,'style':'width:'+w+'px'});
		if(!required)s.appendChild(E('option',{'value':''},'--'));
		opts.forEach(function(o){s.appendChild(E('option',{'value':o},o));});
		parent.appendChild(s);
	},
	qaNum:function(parent,opt,ph,w){
		var id=this.qaId(parent,opt);
		parent.appendChild(E('label',{'for':id},opt+':'));
		parent.appendChild(E('input',{'id':id,'data-opt':opt,'type':'number','min':'0','placeholder':ph,'style':'width:'+w+'px'}));
	},

	lock:function(){this._n=(this._n||0)+1;},
	unlock:function(){this._n=Math.max(0,(this._n||0)-1);},

	defsNodes:function(){
		var d=null;
		uci.sections('qosify','defaults',function(s){if(!d)d=s;});
		if(!d)return [E('em',{'class':'qos-muted'},_('No config defaults section defined'))];
		var keys=['timeout','dscp_default_tcp','dscp_default_udp','dscp_icmp','dscp_prio','dscp_bulk','prio_max_avg_pkt_len','bulk_trigger_pps','bulk_trigger_timeout'];
		var line=E('div',{'class':'qos-muted','style':'margin:2px 0 0;font-family:monospace'}),first=true;
		keys.forEach(function(k){
			if(!d[k])return;
			if(!first)dom.append(line,'\u00a0\u00a0');
			first=false;
			dom.append(line,[k+': ',E('strong',{},String(d[k]))]);
		});
		return [E('strong',{},'config defaults'),line];
	},

	// qosify.init runs add_class() over both `class` and `alias`, so alias names
	// are equally valid rule targets and dscp_* values. ingress/egress fall back
	// to `value`, mirroring "${ingress:-$value}" in add_class().
	getClasses:function(){
		var arr=[];
		['class','alias'].forEach(function(t){
			uci.sections('qosify',t,function(s){
				arr.push({name:s['.name'],alias:t==='alias',
					ingress:s.ingress||s.value||'',egress:s.egress||s.value||'',
					dscp_prio:s.dscp_prio||'',dscp_bulk:s.dscp_bulk||'',
					prio_max_avg_pkt_len:s.prio_max_avg_pkt_len||'',
					bulk_trigger_pps:s.bulk_trigger_pps||'',
					bulk_trigger_timeout:s.bulk_trigger_timeout||''});
			});
		});
		return arr;
	},

	refreshClasses:function(){
		var classes=this.getClasses();
		var db=$('qos-cfg-def');
		if(db)dom.content(db,this.defsNodes());
		var sel=$('qar-cls');
		if(sel){
			var cur=sel.value;
			dom.content(sel,'');
			classes.forEach(function(c){sel.appendChild(E('option',{'value':c.name},c.name));});
			if(cur&&classes.some(function(c){return c.name===cur;}))sel.value=cur;
		}
		var names=classes.map(function(c){return c.name;}).concat(DSCP);
		['qac-opts-defaults','qac-opts-class'].forEach(function(id){
			var p=$(id);if(!p)return;
			var ss=p.querySelectorAll('select[data-opt^="dscp_"]');
			for(var i=0;i<ss.length;i++){
				var s=ss[i],cur=s.value;
				dom.content(s,'');
				s.appendChild(E('option',{'value':''},'--'));
				names.forEach(function(o){s.appendChild(E('option',{'value':o},o));});
				s.value=cur;
			}
		});
		var ref=$('qos-cls-ref');
		if(ref){
			dom.content(ref,'');
			if(classes.length){
				classes.forEach(function(c){
					ref.appendChild(E('tr',{},[
						E('td',{'style':'width:140px'},clsLabel(c)),
						E('td',{},clsDesc(c))
					]));
				});
			}else{
				ref.appendChild(noClassRow());
			}
		}
		var cbox=$('qos-cfg-cls'),self=this;
		if(cbox){
			dom.content(cbox,'');
			classes.forEach(function(c){cbox.appendChild(self.clsBoxNode(c));});
		}
	},

	tabRules:function(ctx){
		var self=this;
		var section=E('div',{'id':'qos-ru'});
		var fs1=E('fieldset',{'class':'cbi-section'},[
			E('legend',{},_('Classification Rules')),
			E('div',{'class':'cbi-section-descr'},[_('DSCP mapping rules loaded by qosify on startup.')+' ',E('code',{},RULES_PATH)])
		]);

		// Available classes
		var classes=this.getClasses();
		var ref=E('details',{'class':'qos-ref'});
		ref.appendChild(E('summary',{},_('Available Classes')));
		var refTbl=E('table',{'class':'qos-kv','style':'margin:6px 0 0','width':'100%'});
		var refB=E('tbody',{'id':'qos-cls-ref'});refTbl.appendChild(refB);
		if(classes.length){
			classes.forEach(function(c){
				refB.appendChild(E('tr',{},[
					E('td',{'style':'width:140px'},clsLabel(c)),
					E('td',{},clsDesc(c))
				]));
			});
		}else{
			refB.appendChild(noClassRow());
		}
		ref.appendChild(refTbl);
		ref.appendChild(E('div',{'class':'qos-muted','style':'margin:6px 0 2px'},
			_('Prefix with + to override only when the DSCP field is zero. Ports: tcp:443, udp:3074, ranges: tcp:5060-5061 (1-65534). DNS: dns:*teams*, regex: dns:/zoom[0-9]+, CNAME-only: dns_c:. IP: 1.1.1.1, ff01::1')));
		fs1.appendChild(ref);

		// Quick Add Rule
		var qa=E('div',{'class':'qos-qa'});
		qa.appendChild(E('strong',{},_('Quick Add Rule')));
		var qarRow=E('div',{'class':'qos-qa-row'});
		var qarType=E('select',{'id':'qar-type','style':'width:140px','change':function(){self.qarPlaceholder();}});
		[['tcp:',_('tcp port')],['udp:',_('udp port')],['both:',_('tcp+udp port')],['dns:',_('dns pattern')],['dnsr:',_('dns regex')],['dns_c:',_('dns_c pattern')],['dns_cr:',_('dns_c regex')],['ipv4:',_('IPv4 address')],['ipv6:',_('IPv6 address')]].forEach(function(o){
			qarType.appendChild(E('option',{'value':o[0]},o[1]));
		});
		qarRow.appendChild(qarType);
		qarRow.appendChild(E('input',{'id':'qar-val','type':'text','placeholder':_('e.g. %s').format('4500'),'style':'width:180px;font-family:monospace'}));
		var qarCls=E('select',{'id':'qar-cls','style':'width:140px'});
		classes.forEach(function(c){qarCls.appendChild(E('option',{'value':c.name},c.name));});
		qarRow.appendChild(qarCls);
		qarRow.appendChild(E('label',{'class':'qos-muted','style':'white-space:nowrap','for':'qar-prio'},
			[E('input',{'type':'checkbox','id':'qar-prio'}),' '+_('only if unset (+)')]));
		qarRow.appendChild(E('button',{'class':'cbi-button cbi-button-add','click':function(){return self.qarAdd();}},_('Add')));
		qa.appendChild(qarRow);
		fs1.appendChild(qa);

		// Editor
		var ta=E('textarea',{
			'id':'qos-rules-ta','class':'qos-edit','rows':28,
			'style':'line-height:1.4;tab-size:4;padding:6px'
		},ctx.rulesText||'');
		ta.dataset.orig=ctx.rulesText||'';
		stampFile(ta,ctx.rulesStat);
		fs1.appendChild(ta);
		fs1.appendChild(E('div',{'class':'cbi-page-actions'},[
			E('button',{'class':'cbi-button cbi-button-reset','style':'margin-right:6px','click':function(){return self.clearRules();}},_('Clear')),
			E('button',{'class':'cbi-button cbi-button-apply','click':function(){return self.saveRules();}},_('Save & Apply'))
		]));

		section.appendChild(fs1);
		return section;
	},

	tabAdvanced:function(ctx){
		var self=this;
		var section=E('div',{'id':'qos-ad'});

		// Backup
		var fb=E('fieldset',{'class':'cbi-section'},[
			E('legend',{},_('Backup Current Files')),
			E('div',{'class':'cbi-section-descr'},_('Download current config files before making changes.'))
		]);
		fb.appendChild(this.dlRow('/etc/config/qosify','qosify'));
		fb.appendChild(this.dlRow('/etc/qosify/00-defaults.conf','00-defaults.conf'));
		section.appendChild(fb);

		// Upload
		var fu=E('fieldset',{'class':'cbi-section'},[
			E('legend',{},_('Upload Config Files')),
			E('div',{'class':'cbi-section-descr'},_('Select files and click Save & Apply to overwrite and restart qosify.'))
		]);
		var u1=E('input',{'type':'file','id':'qos-up-cfg'});
		var u2=E('input',{'type':'file','id':'qos-up-rules'});
		fu.appendChild(E('div',{'class':'cbi-value'},[
			E('label',{'class':'cbi-value-title'},'/etc/config/qosify'),
			E('div',{'class':'cbi-value-field'},u1)
		]));
		fu.appendChild(E('div',{'class':'cbi-value'},[
			E('label',{'class':'cbi-value-title'},'/etc/qosify/00-defaults.conf'),
			E('div',{'class':'cbi-value-field'},u2)
		]));
		fu.appendChild(E('div',{'class':'cbi-page-actions'},
			E('button',{'class':'cbi-button cbi-button-apply','click':function(){return self.uploadFiles();}},_('Save & Apply'))
		));
		section.appendChild(fu);

		// Reset
		section.appendChild(E('fieldset',{'class':'cbi-section'},[
			E('legend',{},_('Reset to qosify Defaults')),
			E('div',{'class':'cbi-section-descr'},_('Replaces both config files with qosify defaults, qosify will be disabled.')),
			E('div',{'class':'cbi-page-actions'},
				E('button',{'class':'cbi-button cbi-button-negative','click':function(){return self.resetDefaults();}},_('Reset to Defaults')))
		]));
		return section;
	},

	dlRow:function(path,fn){
		return E('div',{'class':'cbi-value'},[
			E('label',{'class':'cbi-value-title'},path),
			E('div',{'class':'cbi-value-field'},
				E('button',{'class':'cbi-button cbi-button-action','data-ro-ok':'1','click':function(){
					return fs.read(path).then(function(content){
						var b=new Blob([content||''],{type:'application/octet-stream'});
						var url=URL.createObjectURL(b);
						var a=E('a',{'href':url,'download':fn,'style':'display:none'});
						document.body.appendChild(a);
						a.click();
						setTimeout(function(){
							URL.revokeObjectURL(url);
							if(a.parentNode)a.parentNode.removeChild(a);
						},2000);
					}).catch(function(e){
						notify(_('Could not read %s: %s').format(path,e),'danger');
					});
				}},_('Download')))
		]);
	},

	tabStatus:function(ctx){
		var section=E('div',{'id':'qos-st'});
		var fs1=E('fieldset',{'class':'cbi-section'},E('legend',{},_('qosify-status')));
		var body=E('div',{'id':'qos-st-body'},[
			E('div',{'id':'qos-st-sum'}),
			E('pre',{'id':'qos-st-pre','class':'qos-pre','style':'display:none'}),
			E('div',{'id':'qos-st-msg'})
		]);
		this.fillStatus(body,ctx);
		fs1.appendChild(body);
		section.appendChild(fs1);
		return section;
	},

	lintAll:function(){
		var out=[];
		function walk(type,dev){
			uci.sections('qosify',type,function(s){
				if(uciBool(s.disabled,false))return;
				ifLint(s,dev).forEach(function(t){out.push(s['.name']+': '+t);});
			});
		}
		walk('interface',false);
		walk('device',true);
		return out;
	},

	// Runs on every poll tick and twice per open, so only the summary table is
	// rebuilt: replacing the <pre> would throw away the scroll position while it
	// is being read. ctx.qstatus null means the fork has not returned yet, '' means
	// it returned nothing -- the two used to look the same on screen.
	fillStatus:function(body,ctx){
		var sum=body.querySelector('#qos-st-sum'),pre=body.querySelector('#qos-st-pre'),msg=body.querySelector('#qos-st-msg');
		if(!sum||!pre||!msg)return;
		var note=function(t){dom.content(msg,E('p',{'class':'qos-muted'},E('em',{},t)));};
		if(!ctx.running){
			dom.content(sum,'');
			pre.style.display='none';
			dom.content(msg,E('div',{'class':'alert-message warning'},_('qosify is not running. Start from the Overview tab.')));
			return;
		}
		dom.content(sum,this.statusSummary(ctx.status));
		pre.style.display=ctx.qstatus?'':'none';
		if(ctx.qstatus){
			if(pre.textContent!==ctx.qstatus)pre.textContent=ctx.qstatus;
			dom.content(msg,'');
		}
		else if(this.readonly)note(_('The detailed tc output needs write access to this page.'));
		else if(ctx.qstatus==null)note(_('Reading tc output...'));
		else note(_('qosify-status returned no output.'));
	},

	// ubus call qosify status, so the per-interface summary costs no forks
	statusSummary:function(st){
		var tbl=E('table',{'class':'qos-kv','width':'100%'}),b=E('tbody');
		tbl.appendChild(b);
		['interfaces','devices'].forEach(function(g){
			var t=st&&st[g],k,e;
			for(k in t){
				e=t[k]||{};
				b.appendChild(E('tr',{},[
					E('td',{},(g==='devices'?_('device %s'):_('interface %s')).format(k)),
					E('td',{},[
						E('span',{'class':'qos-badge '+(e.active?'qos-green':'qos-red')},e.active?_('active'):_('inactive')),
						E('span',{'class':'qos-muted','style':'margin-left:8px'},
							_('device: %s, ingress: %s, egress: %s').format(e.ifname||'-',e.ingress?_('yes'):_('no'),e.egress?_('yes'):_('no')))
					])
				]));
			}
		});
		if(!b.firstChild)b.appendChild(E('tr',{},E('td',{'class':'qos-muted'},E('em',{},_('qosify has no interfaces or devices configured')))));
		return tbl;
	},

	// === Actions ===

	svcAction:function(action){
		var self=this;
		self.lock();
		ui.showModal(_('Working'),[E('p',{},_('Sending %s to qosify...').format(action))]);
		var p=callRcInit('qosify',action);
		if(action==='start'||action==='restart')
			p=p.then(function(){return self.waitForRunning(4000);}).then(function(up){
				if(!up)throw new Error(_('qosify did not come up — check the system log'));
			});
		if(action==='stop')
			p=p.then(function(){return self.waitForStopped(4000);}).then(function(down){
				if(!down)throw new Error(_('qosify is still running — leaving the qdiscs alone'));
				return fs.exec('/usr/share/qosify-luci/cleanup',[]).then(function(r){
					if(r&&r.code)notify(_('Cleanup exited with code %d').format(r.code),'warning');
				});
			});
		return p.then(function(){
			return new Promise(function(r){setTimeout(r,800);});
		}).then(function(){
			return self.refreshOverview();
		}).catch(function(e){
			notify(_('Service action failed: %s').format(e),'danger');
		}).finally(function(){
			ui.hideModal();
			self.unlock();
		});
	},

	saveQuick:function(){
		var self=this;
		var get=function(id){var e=$('q-'+id);return e?e.value:'';};
		var chk=function(id){var e=$('q-'+id);return e&&e.checked;};
		var bw=function(s){return trim(s).replace(/\s+/g,'');};
		var bwUp=bw(get('bw_up')),bwDn=bw(get('bw_down'));
		var rate=/^(unlimited|\d+(\.\d+)?((k|m|g|t)?(bit|bps)|(ki|mi|gi)(bit|bps))?)$/i;
		var ovh=get('overhead'),mode=get('mode'),ovhB=trim(get('overhead_b'));
		var iopts=trim(get('ing_opts')),eopts=trim(get('egr_opts')),gopts=trim(get('opts'));
		var safe=/^[\w\s.:-]*$/;
		if(!safe.test(iopts)||!safe.test(eopts)||!safe.test(gopts)){
			notify(_('Error: invalid characters in options fields. Use alphanumeric, spaces, hyphens, dots, colons only.'),'danger');
			return;
		}
		if(bwUp&&!rate.test(bwUp))notify(_('bandwidth_up does not look like a tc rate (100mbit, 12MBps, unlimited) — passing it through anyway').format(),'warning');
		if(bwDn&&!rate.test(bwDn))notify(_('bandwidth_down does not look like a tc rate (100mbit, 12MBps, unlimited) — passing it through anyway').format(),'warning');
		if(ovh==='manual'&&ovhB&&!/^\d+$/.test(ovhB)){notify(_('Error: overhead must be a whole number of bytes'),'danger');return;}
		var en=chk('enabled');
		if(en&&(!bwUp||!bwDn))notify(_('Note: bandwidth not set — CAKE will run unlimited on that direction.'),'warning');

		var s0=ifSect(),sty=s0?s0.type:'interface',sec=s0?s0.name:'wan',sidx=s0?s0.idx:0;
		// null = remove the option, so clearing a field actually clears it
		var kv={
			disabled:en?'0':'1',
			bandwidth_up:bwUp||null,
			bandwidth_down:bwDn||null,
			overhead_type:ovh||null,
			mode:mode||null,
			ingress:chk('ingress')?'1':'0',
			egress:chk('egress')?'1':'0',
			nat:chk('nat')?'1':'0',
			host_isolate:chk('host_isolate')?'1':'0',
			autorate_ingress:chk('autorate')?'1':'0',
			ingress_options:iopts||null,
			egress_options:eopts||null,
			options:gopts||null,
			option:null
		};
		kv.overhead=(ovh==='manual'&&ovhB)?ovhB:null;
		var nmEl=$('q-name');
		if(nmEl){
			var nm=trim(nmEl.value);
			if(nm&&!/^[\w.@:-]+$/.test(nm)){notify(_('Error: name must be a device or interface name'),'danger');return;}
			kv.name=nm||null;
		}

		self.lock();
		ui.showModal(_('Saving'),[E('p',{},_('Saving settings and applying...'))]);
		return callUciRevert('qosify').then(function(){
			return Promise.all([fs.read(UCI_PATH),L.resolveDefault(fs.stat(UCI_PATH),null)]);
		}).then(function(r){
			var txt=r[0]||'',st=r[1];
			if(!trim(txt)&&st&&st.size>0)
				throw new Error(_('%s came back empty although it is %d bytes on disk — refusing to overwrite it').format(UCI_PATH,st.size));
			return fs.write(UCI_PATH,setOpts(txt,sty,sec,sidx,kv));
		}).then(function(){
			uci.unload('qosify');
			return uci.load('qosify');
		}).then(function(){
			return self.applyService();
		}).then(function(){
			return self.checkShapingForSave(_('Settings saved'));
		}).then(function(msg){
			ui.hideModal();
			notify(msg.text,msg.kind);
			self.lintAll().forEach(function(t){notify(t,'warning');});
			return self.refreshAll();
		}).catch(function(e){
			ui.hideModal();
			notify(_('Save failed: %s').format(e),'danger');
		}).finally(function(){self.unlock();});
	},

	confirmFresh:function(el,path){
		return L.resolveDefault(fs.stat(path),null).then(function(st){
			if(!fileMoved(el,st))return true;
			return confirmDialog(_('File changed on disk'),
				_('%s has changed since this editor was loaded. Saving now discards those changes.').format(path),
				_('Overwrite'),true);
		});
	},

	saveConfig:function(){
		var self=this;
		var ta=$('qos-config-ta');
		if(!ta)return;
		var data=ta.value.replace(/\r\n/g,'\n');
		if(data.length===0)return self.clearConfig(ta);
		if(!/(^|\n)config /.test(data)){
			notify(_('Error: No valid config stanzas found.'),'danger');return;
		}
		return self.confirmFresh(ta,UCI_PATH).then(function(go){
			if(!go)return null;
			return self.writeConfig(ta,data);
		});
	},

	// Truncating the file gets the file-changed check every other write gets, plus
	// one of its own: when gatherCtx()'s read fails the editor is left empty but
	// still carries the size and mtime it found on disk, so fileMoved() sees
	// nothing wrong and confirmFresh() would wave a wipe through. dataset.orig is
	// what separates "the user emptied it" from "it never loaded".
	clearConfig:function(ta){
		var self=this;
		return L.resolveDefault(fs.stat(UCI_PATH),null).then(function(st){
			if(st&&st.size>0&&!(ta.dataset.orig||'').length){
				notify(_('%s is %d bytes on disk but was never loaded into the editor — refusing to truncate it. Reload the page first.').format(UCI_PATH,st.size),'danger');
				return null;
			}
			return self.confirmFresh(ta,UCI_PATH).then(function(go){
				if(!go)return null;
				return confirmDialog(_('Clear configuration'),
					_('An empty %s stops all shaping. Continue?').format(UCI_PATH),_('Write empty file'),true);
			}).then(function(go){
				if(!go)return null;
				var stopped=false;
				self.lock();
				return callUciRevert('qosify').then(function(){
					return fs.write(UCI_PATH,'');
				}).then(function(){
					return callRcInit('qosify','stop');
				}).then(function(){
					return self.waitForStopped(4000);
				}).then(function(down){
					// cleanup deletes the root and clsact qdiscs and the ifb devices, so
					// it only runs once the daemon is confirmed down -- the same guard
					// svcAction() applies to a plain stop.
					stopped=down;
					if(!down){notify(_('qosify is still running — leaving the qdiscs alone'),'warning');return null;}
					return L.resolveDefault(fs.exec('/usr/share/qosify-luci/cleanup',[]),null);
				}).then(function(){
					uci.unload('qosify');
					return uci.load('qosify');
				}).then(function(){
					ta.dataset.orig='';
					notify(stopped?_('Config cleared, qosify stopped.'):_('Config cleared.'),'info');
					return self.refreshAll('cfg');
				}).catch(function(e){
					notify(_('Save failed: %s').format(e),'danger');
				}).finally(function(){self.unlock();});
			});
		});
	},

	writeConfig:function(ta,data){
		var self=this;
		self.lock();
		ui.showModal(_('Saving'),[E('p',{},_('Writing config and reloading qosify...'))]);
		return callUciRevert('qosify').then(function(){
			return fs.write(UCI_PATH,data);
		}).then(function(){
			uci.unload('qosify');
			return uci.load('qosify');
		}).then(function(){
			return self.applyService();
		}).then(function(){
			return self.checkShapingForSave(_('Config saved'));
		}).then(function(msg){
			ta.dataset.orig=data;
			ui.hideModal();
			notify(msg.text,msg.kind);
			self.lintAll().forEach(function(t){notify(t,'warning');});
			return self.refreshAll('cfg');
		}).catch(function(e){
			ui.hideModal();
			notify(_('Save failed: %s').format(e),'danger');
		}).finally(function(){self.unlock();});
	},

	waitForShaping:function(tries){
		var self=this;
		return L.resolveDefault(callQosifyStatus(),{}).then(function(st){
			if(statusActive(st)||tries<=1)return statusActive(st);
			return new Promise(function(res){setTimeout(res,700);}).then(function(){return self.waitForShaping(tries-1);});
		});
	},

	checkShapingForSave:function(prefix){
		var sn=ifSect(),w=(sn&&uci.get('qosify',sn.id))||{};
		if(uciBool(w.disabled,false))return Promise.resolve({text:_('%s, applied (QoS disabled).').format(prefix),kind:'info'});
		return this.waitForShaping(3).then(function(active){
			if(active)return {text:_('%s, applied.').format(prefix),kind:'info'};
			return {text:_('Warning: %s but qosify is not shaping traffic — check the Status tab.').format(prefix),kind:'warning'};
		});
	},

	saveRules:function(){
		var self=this;
		var ta=$('qos-rules-ta');
		if(!ta)return;
		var data=ta.value.replace(/\r\n/g,'\n');
		var verr=validateRules(data);
		if(verr){notify(_('Error: %s').format(verr),'danger');return;}
		var rwarn=ruleWarn(data,self.getClasses().map(function(c){return c.name;}));
		return self.confirmFresh(ta,RULES_PATH).then(function(go){
			if(!go)return null;
			return self.writeRules(ta,data,rwarn);
		});
	},

	writeRules:function(ta,data,rwarn){
		var self=this;
		self.lock();
		ui.showModal(_('Saving'),[E('p',{},_('Writing rules and reloading qosify...'))]);
		return fs.write(RULES_PATH,data).then(function(){
			return self.applyService();
		}).then(function(){
			return self.checkShapingForSave(_('Rules saved'));
		}).then(function(msg){
			ta.dataset.orig=data;
			ui.hideModal();
			notify(msg.text,msg.kind);
			rwarn.forEach(function(t){notify(t,'warning');});
			return self.refreshAll('rules');
		}).catch(function(e){
			ui.hideModal();
			notify(_('Save failed: %s').format(e),'danger');
		}).finally(function(){self.unlock();});
	},

	clearCfg:function(){
		return confirmDialog(_('Clear editor'),_('Empty the config editor? Nothing is written until you click Save & Apply.'),_('Clear')).then(function(go){
			var ta=$('qos-config-ta');
			if(go&&ta)ta.value='';
		});
	},
	clearRules:function(){
		return confirmDialog(_('Clear editor'),_('Empty the rules editor? Nothing is written until you click Save & Apply.'),_('Clear')).then(function(go){
			var ta=$('qos-rules-ta');
			if(go&&ta)ta.value='';
		});
	},

	uploadFiles:function(){
		var self=this;
		var u1=$('qos-up-cfg'),u2=$('qos-up-rules');
		var f1=u1&&u1.files[0],f2=u2&&u2.files[0];
		if(!f1&&!f2){notify(_('No files selected.'),'warning');return;}
		return confirmDialog(_('Overwrite config files'),
			_('The selected files replace the ones on the router and qosify is reloaded. Download a backup from this tab first if you need one.'),
			_('Upload and apply'),true).then(function(go){
			if(!go)return null;
			return self.doUpload(u1,u2,f1,f2);
		});
	},

	doUpload:function(u1,u2,f1,f2){
		var self=this;

		function readFile(f){
			return new Promise(function(res,rej){
				if(f.size<1)return rej(_('Empty file'));
				if(f.size>65536)return rej(_('File too large (max 64KB)'));
				var r=new FileReader();
				r.onload=function(){res(r.result);};
				r.onerror=function(){rej(_('Read error'));};
				r.readAsText(f);
			});
		}
		function validateUci(d){
			if(/\x00/.test(d))return _('Binary content rejected');
			if(!/(^|\n)config /.test(d))return _('No valid UCI config stanzas');
			return null;
		}
		self.lock();
		ui.showModal(_('Uploading'),[E('p',{},_('Reading and validating files...'))]);
		var names=[],errs=[],warns=[];
		// Sequential on purpose: the uploaded UCI config is written and reloaded
		// first, so ruleWarn() below sees the uploaded classes, not the old ones.
		var p=Promise.resolve();
		if(f1)p=p.then(function(){return readFile(f1).then(function(d){
			var e=validateUci(d);
			if(e){errs.push(_('Config: %s').format(e));return null;}
			return callUciRevert('qosify').then(function(){
				return fs.write(UCI_PATH,d);
			}).then(function(){
				names.push(UCI_PATH);
				uci.unload('qosify');
				return uci.load('qosify');
			});
		},function(e){errs.push(_('Config: %s').format(e));});});
		if(f2)p=p.then(function(){return readFile(f2).then(function(d){
			var e=validateRules(d);
			if(e){errs.push(_('Rules: %s').format(e));return null;}
			ruleWarn(d,self.getClasses().map(function(c){return c.name;})).forEach(function(t){warns.push(t);});
			return fs.write(RULES_PATH,d).then(function(){names.push('00-defaults.conf');});
		},function(e){errs.push(_('Rules: %s').format(e));});});

		return p.then(function(){
			if(names.length===0){
				ui.hideModal();
				notify(_('Upload error: %s').format(errs.join('; ')),'danger');
				return;
			}
			uci.unload('qosify');
			return uci.load('qosify').then(function(){
				return self.applyService();
			}).then(function(){
				ui.hideModal();
				var msg=_('%s uploaded, qosify reloaded.').format(names.join(' & '));
				if(errs.length)msg+=' '+_('Errors:')+' '+errs.join('; ');
				notify(msg,errs.length?'warning':'info');
				warns.forEach(function(t){notify(t,'warning');});
				if(u1)u1.value='';
				if(u2)u2.value='';
				return self.refreshAll();
			});
		}).catch(function(e){
			ui.hideModal();
			notify(_('Upload failed: %s').format(e),'danger');
		}).finally(function(){self.unlock();});
	},

	resetDefaults:function(){
		var self=this;
		return confirmDialog(_('Reset to defaults'),
			_('%s and %s are replaced with the templates shipped by the qosify package, and shaping is left disabled.').format(UCI_PATH,RULES_PATH),
			_('Reset'),true).then(function(go){
			if(!go)return null;
			return self.doReset();
		});
	},

	doReset:function(){
		var self=this;
		self.lock();
		ui.showModal(_('Resetting'),[E('p',{},_('Restoring defaults...'))]);
		return callUciRevert('qosify').then(function(){
			return Promise.all([
				fs.read('/usr/share/qosify-luci/qosify'),
				fs.read('/usr/share/qosify-luci/00-defaults.conf')
			]);
		}).then(function(t){
			return fs.write(UCI_PATH,t[0]).catch(function(e){
				throw new Error(_('%s was not written: %s').format(UCI_PATH,e));
			}).then(function(){
				return fs.write(RULES_PATH,t[1]).catch(function(e){
					throw new Error(_('%s was reset but %s was not written: %s').format(UCI_PATH,RULES_PATH,e));
				});
			});
		}).then(function(){
			uci.unload('qosify');
			return uci.load('qosify');
		}).then(function(){
			return self.applyService();
		}).then(function(){
			ui.hideModal();
			notify(_('Reset to defaults, applied.'),'info');
			return self.refreshAll();
		}).catch(function(e){
			ui.hideModal();
			notify(_('Reset failed: %s').format(e),'danger');
		}).finally(function(){self.unlock();});
	},

	// === Quick Add handlers ===

	qarPlaceholder:function(){
		var t=$('qar-type').value;
		var v=$('qar-val');
		var eg=function(x){return _('e.g. %s').format(x);};
		var ph={'tcp:':eg('4500'),'udp:':eg('4500'),'both:':eg('5060-5061'),
			'dns:':eg('*teams*'),'dnsr:':eg('zoom[0-9]+\\.us'),'dns_c:':eg('*cdn*'),'dns_cr:':eg('cdn[0-9]+'),
			'ipv4:':eg('1.1.1.1'),'ipv6:':eg('ff01::1')};
		v.placeholder=ph[t]||'';
	},

	qarAdd:function(){
		var ty=$('qar-type').value;
		var val=trim($('qar-val').value);
		var cls=$('qar-cls').value;
		var pr=$('qar-prio').checked;
		if(!val){notify(_('Enter a value.'),'danger');return;}
		if(!cls){notify(_('No classes defined. Add classes in the Config tab first.'),'danger');return;}
		var pt=(ty==='tcp:'||ty==='udp:'||ty==='both:');
		if(pt){
			var pp=val.split('-'),pn=[],j,n;
			if(pp.length>2){notify(_('Port must be a number or a range (4500, 5060-5061).'),'danger');return;}
			for(j=0;j<pp.length;j++){
				n=dscpNum(trim(pp[j]));
				if(n===null){notify(_('Port must be a number or a range (4500, 5060-5061).'),'danger');return;}
				if(n<1||n>65534){notify(_('Port must be 1-65534 (qosify rejects 65535).'),'danger');return;}
				pn.push(n);
			}
			if(pn.length===2&&pn[0]>pn[1]){notify(_('Range start must not exceed end.'),'danger');return;}
		}else if(/[\s#]/.test(val)){notify(_('No spaces or # allowed in patterns or addresses.'),'danger');return;}
		if(ty==='ipv4:'){
			var oc=val.split('.');
			if(oc.length!==4||oc.some(function(x){return !/^\d{1,3}$/.test(x)||+x>255;})){notify(_('Enter a single IPv4 address (qosify does not accept CIDR).'),'danger');return;}
		}
		// inet_pton(AF_INET6) also takes the IPv4-mapped form, so allow dots here
		if(ty==='ipv6:'&&(!/^[0-9a-fA-F:.]+$/.test(val)||val.indexOf(':')<0||val.length>45)){notify(_('Enter a single IPv6 address (qosify does not accept CIDR or a %zone suffix).'),'danger');return;}
		var pfx=pr?'+':'';
		var ta=$('qos-rules-ta');if(!ta)return;
		var lines=[];
		if(ty==='both:'){lines.push('tcp:'+val+'\t'+pfx+cls);lines.push('udp:'+val+'\t'+pfx+cls);}
		else if(ty==='ipv4:'||ty==='ipv6:')lines.push(val+'\t'+pfx+cls);
		else if(ty==='dnsr:')lines.push('dns:/'+val+'\t'+pfx+cls);
		else if(ty==='dns_cr:')lines.push('dns_c:/'+val+'\t'+pfx+cls);
		else lines.push(ty+val+'\t'+pfx+cls);
		var v=ta.value.replace(/\s+$/,'');
		ta.value=v+(v?'\n\n':'')+lines.join('\n')+'\n';
		$('qar-val').value='';
		$('qar-prio').checked=false;
		ta.scrollTop=ta.scrollHeight;
	},

	qacSwitch:function(){
		var ty=$('qac-type').value,p=QAC_PANEL[ty];
		['defaults','class','interface'].forEach(function(x){
			var el=$('qac-opts-'+x);
			if(el)el.style.display=(x===p)?'flex':'none';
		});
		$('qac-nm-w').style.display=(ty==='defaults')?'none':'';
	},

	qacAdd:function(){
		var ty=$('qac-type').value;
		var ta=$('qos-config-ta');if(!ta)return;
		var nm='',secs=cfgSections(ta.value);
		if(ty!=='defaults'){
			nm=trim($('qac-name').value);
			if(!nm){notify(_('Enter a section name.'),'danger');return;}
			if(!/^[a-zA-Z0-9_]+$/.test(nm)){notify(_('A section name may only contain letters, digits and underscores.'),'danger');return;}
		}
		if(ty==='defaults'&&secs.some(function(x){return x.type==='defaults';})){notify(_('A config defaults section already exists.'),'danger');return;}
		if(nm&&secs.some(function(x){return x.type===ty&&x.name===nm;})){notify(_('Section %s already exists.').format(nm),'danger');return;}
		var s='config '+ty+(nm?" '"+nm+"'":'');
		var div=$('qac-opts-'+QAC_PANEL[ty]);
		var els=div.querySelectorAll('[data-opt]');
		for(var i=0;i<els.length;i++){
			var v=els[i].value;if(!v)continue;
			v=qv(v);
			var opt=els[i].getAttribute('data-opt');
			var pre=els[i].getAttribute('data-pre')||'option';
			s+="\n\t"+pre+" "+opt+" '"+v+"'";
		}
		var cv=ta.value.replace(/\s+$/,'');
		ta.value=cv+(cv?'\n\n':'')+s+'\n';
		if(nm)$('qac-name').value='';
		for(i=0;i<els.length;i++){
			if(els[i].tagName==='SELECT')els[i].selectedIndex=0;
			else els[i].value=els[i].defaultValue||'';
		}
		ta.scrollTop=ta.scrollHeight;
	},

	// === Refreshers ===

	gatherCtx:function(withFiles){
		var self=this;
		return Promise.all([
			L.resolveDefault(callServiceList('qosify'),{}),
			L.resolveDefault(callRcList('qosify',true),{}),
			L.resolveDefault(callQosifyStatus(),{}),
			L.resolveDefault(fs.stat(UCI_PATH),null),
			L.resolveDefault(fs.stat(RULES_PATH),null),
			withFiles?fs.read(UCI_PATH).catch(function(){return null;}):null,
			withFiles?fs.read(RULES_PATH).catch(function(){return null;}):null
		]).then(function(d){
			var rc=d[1]&&d[1].qosify;
			var ctx={
				running:isRunning(d[0]),
				enabled:!!(rc&&rc.enabled),
				hasInit:!!rc,
				status:d[2]||{},
				active:statusActive(d[2]),
				shaped:statusCount(d[2]),
				cfgStat:d[3],
				rulesStat:d[4],
				cfgRaw:d[5],
				rulesText:d[6],
				qstatus:null
			};
			if(withFiles){
				self._rulesN=countRules(ctx.rulesText);
				self._cfgOk=(ctx.cfgRaw||'').length>10&&/(^|\n)config /.test(ctx.cfgRaw||'');
				if(ctx.cfgRaw===null)notify(_('%s could not be read — the editor is left empty and will not be saved over it.').format(UCI_PATH),'danger');
			}
			ctx.rulesN=self._rulesN;
			ctx.cfgOk=self._cfgOk;
			return ctx;
		});
	},

	// Poll path: five ubus calls, no shell forks, and the parts of the page that
	// hold user input or focus are patched in place rather than rebuilt.
	refreshOverview:function(){
		var self=this;
		self.lock();
		uci.unload('qosify');
		return uci.load('qosify').then(function(){
			return self.gatherCtx(false);
		}).then(function(ctx){
			self.updateSvcTable(ctx);
			self.fillSect('qos-cfg-sect',self.buildCfgSect(ctx));
			var bd=$('q-en-badge');
			if(bd){
				var sn=ifSect(),w=(sn&&uci.get('qosify',sn.id))||{};
				self.updateEnBadge(bd,ctx,w['.name']!=null&&!uciBool(w.disabled,false));
			}
			return ctx;
		}).finally(function(){self.unlock();});
	},

	refreshOverviewFull:function(){
		var self=this;
		return self.refreshOverview().then(function(ctx){
			self.fillSect('qos-svc-sect',self.buildSvcSect(ctx));
			self.fillSect('qos-ctl-sect',self.buildCtlSect(ctx));
			self.fillSect('qos-qs-sect',self.buildQsSect(ctx));
			return ctx;
		});
	},

	refreshStatus:function(){
		var self=this;
		if(self.currentTab!=='st'||self._st)return Promise.resolve();
		self._st=true;
		var ex=self.readonly?Promise.resolve(null):L.resolveDefault(fs.exec('/usr/sbin/qosify-status',[]),null);
		return Promise.all([
			L.resolveDefault(callServiceList('qosify'),{}),
			L.resolveDefault(callQosifyStatus(),{})
		]).then(function(d){
			var ctx={running:isRunning(d[0]),status:d[1]||{},qstatus:self.readonly?'':null};
			var stb=$('qos-st-body');
			if(stb)self.fillStatus(stb,ctx);
			return ex.then(function(r){
				ctx.qstatus=self.readonly?'':((r&&r.stdout)||'');
				if(stb)self.fillStatus(stb,ctx);
			});
		}).finally(function(){self._st=false;});
	},

	// which = 'cfg' | 'rules' | undefined: the editor for the file just written is
	// reloaded, the other one keeps whatever the user has typed.
	refreshAll:function(which){
		var self=this;
		return self.refreshOverviewFull().then(function(){
			self.refreshClasses();
			return Promise.all([
				self.reloadEditor('qos-config-ta',UCI_PATH,which==='cfg'),
				self.reloadEditor('qos-rules-ta',RULES_PATH,which==='rules')
			]);
		});
	},

	reloadEditor:function(id,path,force){
		var el=$(id);
		if(!el)return Promise.resolve();
		return Promise.all([
			L.resolveDefault(fs.read(path),null),
			L.resolveDefault(fs.stat(path),null)
		]).then(function(r){
			var disk=r[0];
			if(disk==null)return;
			var dirty=(el.dataset.orig!=null&&el.value!==el.dataset.orig);
			if(dirty&&!force&&el.value!==disk){
				notify(_('%s changed on disk — your unsaved edits are still in the editor.').format(path),'warning');
				return;
			}
			el.value=disk;
			el.dataset.orig=disk;
			stampFile(el,r[1]);
		});
	}
});
