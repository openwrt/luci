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

var callInit=rpc.declare({
	object:'luci',
	method:'setInitAction',
	params:['name','action'],
	expect:{result:false}
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
	params:['config']
});
function isRunning(r){
	try{var i=r.qosify.instances;for(var k in i)if(i[k].running)return true;}catch(e){}
	return false;
}

function clsLabel(c){return c.name+(c.alias?' '+_('(alias)'):'');}
function clsDesc(c){return _('Ingress: %s / Egress: %s').format(c.ingress||'',c.egress||'');}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
function trim(s){return (s||'').replace(/^\s+|\s+$/g,'');}
function $(id){return document.getElementById(id);}

function detectActive(out){return /qdisc cake|: active/.test(out||'');}

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
		if(l&&!/^\S+\s+\S/.test(l))return _('Invalid rule line: %s').format(l.slice(0,40));
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
			a.push({type:t,id:s['.name'],name:s['.anonymous']?'':s['.name'],idx:i++,on:s.disabled!=='1'});
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
		ingress:s.ingress!=='0',
		egress:s.egress!=='0',
		host_isolate:s.host_isolate!=='0',
		autorate:s.autorate_ingress==='1',
		nat:(s.nat==null||s.nat==='')?!dev:(s.nat!=='0')
	};
}
function hasNat(v){return /(^|\s)nat(\s|$)/.test(v||'');}
// Keys the daemon will silently drop, given the rest of the section.
function ifLint(s,dev){
	var w=[],c=ifCfg(s,dev);
	if(!s.name)w.push(_('name is not set — qosify.init sends an empty device name and this section is never applied'));
	if(!c.host_isolate&&s.nat==='1'){
		var ne=hasNat(s.options)||hasNat(s.egress_options);
		var ni=hasNat(s.options)||hasNat(s.ingress_options);
		if(!ne&&!ni)w.push(_('nat is not sent: qosify only emits nat/nonat inside the host_isolate branch. CAKE does accept flows plus nat — put nat in options to apply it'));
		else if(!ne||!ni)w.push(_('nat only reaches %s — put it in options, or in both ingress_options and egress_options').format(ne?'egress':'ingress'));
	}
	if(s.overhead_type!=='manual'&&(s.overhead||s.overhead_encap))w.push(_('overhead and overhead_encap are ignored unless overhead_type is manual'));
	if(!c.ingress&&!c.egress)w.push(_('ingress and egress are both 0 — nothing is shaped'));
	if(c.egress&&!c.bw_up)w.push(_('no bandwidth_up or bandwidth — egress CAKE runs unlimited'));
	if(c.ingress&&!c.bw_dn)w.push(_('no bandwidth_down or bandwidth — ingress CAKE runs unlimited'));
	['bandwidth_up','bandwidth_down','bandwidth','mode','ingress_options','egress_options','options'].forEach(function(k){
		if(s[k]&&String(s[k]).indexOf("'")>=0)w.push(_('%s contains a quote — qosify rejects the whole value').format(k));
	});
	return w;
}
// Locate config blocks in raw UCI text: {type,name,start,end} (end = last non-blank
// line). Headers may be bare, single- or double-quoted — all three are valid UCI.
function unq(s){return String(s||'').replace(/^["']|["']$/g,'');}
function cfgSections(txt){
	var out=[],cur=null,lines=(txt||'').split('\n');
	for(var i=0;i<lines.length;i++){
		var m=/^\s*config\s+(\S+)(?:\s+(\S+))?\s*$/.exec(lines[i]);
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
function ruleWarn(txt,names){
	var bad=[],lines=(txt||'').split('\n');
	for(var i=0;i<lines.length;i++){
		var l=lines[i],h=l.indexOf('#');
		if(h>=0)l=l.slice(0,h);
		l=trim(l);if(!l)continue;
		var f=l.split(/\s+/);if(f.length<2)continue;
		var v=f[1].replace(/^\+/,'');
		if(names.indexOf(v)>=0||DSCP.indexOf(v)>=0)continue;
		if(/^(0[xX][0-9a-fA-F]+|\d+)$/.test(v)){
			if(parseInt(v,v.charAt(0)==='0'&&(v.charAt(1)==='x'||v.charAt(1)==='X')?16:10)<64)continue;
		}
		if(bad.indexOf(v)<0)bad.push(v);
	}
	return bad.length?_('Unknown class/DSCP target: %s').format(bad.slice(0,5).join(', ')):null;
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

return view.extend({
	handleSaveApply:null,handleSave:null,handleReset:null,
	currentTab:'ov',

	load:function(){
		return Promise.all([
			uci.load('qosify').catch(function(){return null;}),
			L.resolveDefault(fs.read(RULES_PATH),''),
			L.resolveDefault(fs.read(UCI_PATH),''),
			L.resolveDefault(fs.stat(UCI_PATH),null),
			L.resolveDefault(fs.stat(RULES_PATH),null),
			L.resolveDefault(callServiceList('qosify'),{}),
			L.resolveDefault(fs.exec('/etc/init.d/qosify',['enabled']),{code:1}),
			L.resolveDefault(fs.stat('/usr/sbin/qosify'),null),
			L.resolveDefault(fs.stat('/etc/init.d/qosify'),null),
			L.resolveDefault(fs.exec('/usr/sbin/qosify-status',[]),{stdout:''})
		]);
	},

	render:function(d){
		var ctx={
			rulesText:d[1]||'',
			cfgRaw:d[2]||'',
			cfgStat:d[3],
			rulesStat:d[4],
			running:isRunning(d[5]),
			enabled:d[6].code===0,
			hasBin:d[7]!=null,
			hasInit:d[8]!=null,
			qstatus:(d[9]&&d[9].stdout)||'',
		};
		ctx.active=detectActive(ctx.qstatus);

		var root=E('div',{'class':'cbi-map','id':'qos-app'});
		root.appendChild(E('style',{},this.css()));
		root.appendChild(E('h2',{},'qosify'));
		root.appendChild(E('div',{'class':'cbi-map-descr'},_('Traffic shaping and DSCP classification via qosify')));

		var tabs=E('ul',{'class':'cbi-tabmenu'});
		var tabDef=[['ov',_('Overview')],['cf',_('Config')],['ru',_('Classification Rules')],['ad',_('Advanced')],['st',_('Status')]];
		var self=this;
		tabDef.forEach(function(t){
			var li=E('li',{'class':'cbi-tab-disabled','id':'th-'+t[0]},
				E('a',{'href':'#','click':function(ev){ev.preventDefault();self.showTab(t[0]);}},t[1]));
			tabs.appendChild(li);
		});
		root.appendChild(tabs);

		root.appendChild(this.tabOverview(ctx));
		root.appendChild(this.tabConfig(ctx));
		root.appendChild(this.tabRules(ctx));
		root.appendChild(this.tabAdvanced(ctx));
		root.appendChild(this.tabStatus(ctx));

		var hash=(location.hash||'').slice(1);
		var map={overview:'ov',config:'cf',rules:'ru',advanced:'ad',status:'st'};
		setTimeout(function(){self.showTab(map[hash]||'ov');},0);

		this.installPollers();
		return root;
	},

	installPollers:function(){
		var self=this;
		poll.add(function(){if(self.currentTab!=='ov'||self._n)return;return self.refreshOverview();},10);
		poll.add(function(){return self.refreshStatus();},5);
	},

	showTab:function(t){
		var dirty=this.dirty();
		if(dirty&&(this.currentTab==='cf'||this.currentTab==='ru')&&t!==this.currentTab){
			if(!confirm(_('You have unsaved changes. Leave this tab?')))return;
		}
		this.currentTab=t;
		['ov','cf','ru','ad','st'].forEach(function(x){
			var el=$('qos-'+x),th=$('th-'+x);
			if(!el||!th)return;
			if(x===t){el.style.display='block';th.className='cbi-tab';}
			else{el.style.display='none';th.className='cbi-tab-disabled';}
		});
		var rev={ov:'overview',cf:'config',ru:'rules',ad:'advanced',st:'status'};
		try{history.replaceState(null,'','#'+rev[t]);}catch(e){}
	},

	dirty:function(){
		var c=$('qos-config-ta'),r=$('qos-rules-ta');
		if(c&&c.dataset.orig!=null&&c.value!==c.dataset.orig)return true;
		if(r&&r.dataset.orig!=null&&r.value!==r.dataset.orig)return true;
		return false;
	},

	css:function(){return [
		'.qos-badge{display:inline-block;padding:2px 10px;border-radius:3px;font-size:12px;font-weight:bold;color:#fff}',
		'.qos-green{background:#4caf50}.qos-red{background:#e53935}.qos-amber{background:#ff9800}',
		'.qos-ok{color:#4caf50}.qos-err{color:#e53935}.qos-warn{color:#ff9800}',
		'.qos-tab{display:none}.qos-kv td{padding:7px 12px;border-bottom:1px solid #eee}',
		'.qos-kv td:first-child{font-weight:bold;opacity:.7;width:200px}',
		'.qos-kv tr:last-child td{border-bottom:none}',
		'.qos-svc>*{display:inline-block;margin:0 3px 3px 0}',
		'.qos-btn-en{background:transparent !important;border:2px solid #4caf50 !important;color:#4caf50 !important;font-weight:bold}',
		'.qos-btn-en:hover{background:#4caf50 !important;color:#fff !important}',
		'.qos-btn-dis{background:transparent !important;border:2px solid #e53935 !important;color:#e53935 !important;font-weight:bold}',
		'.qos-btn-dis:hover{background:#e53935 !important;color:#fff !important}',
		'.qos-ref{margin:0 0 10px;padding:6px 10px;border:1px solid #888;border-radius:4px}',
		'.qos-ref summary{cursor:pointer;font-weight:bold;font-size:13px}',
		'.qos-qa{margin:0 0 8px;padding:8px 10px;border:1px solid #888;border-radius:4px}',
		'.qos-qa label{font-size:11px;opacity:.7}',
		'.qos-qa-row{display:flex;gap:6px;align-items:center;margin:6px 0 0;flex-wrap:wrap}'
	].join('');},

	tabOverview:function(ctx){
		var section=E('div',{'class':'qos-tab','id':'qos-ov'});
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
		var enChecked=(w['.name']!=null&&w.disabled!=='1');

		var nodes=[];
		nodes.push(E('legend',{},_('Quick Settings')));
		nodes.push(E('div',{'class':'cbi-section-descr'},
			_('Common shaping settings — written straight to %s, section %s.').format(UCI_PATH,sn?'config '+sn.type+(sn.name?" '"+sn.name+"'":' '+_('(unnamed section)')):"config interface 'wan' (will be created)")));
		var tbl=E('table',{'class':'qos-kv','width':'100%'});
		var bdy=E('tbody');tbl.appendChild(bdy);

		function row(lbl,el){bdy.appendChild(E('tr',{},[E('td',{},lbl),E('td',{},el)]));}
		function chk(name,val){return E('input',{'type':'checkbox','id':'q-'+name,'data-q':name,'checked':val?'checked':null});}
		function txt(name,val,ph,style){return E('input',{'type':'text','id':'q-'+name,'data-q':name,'value':val||'','placeholder':ph||'','style':style||'width:140px;font-family:monospace'});}
		function sel(name,val,opts,style,def,hint){
			val=qv(val);
			var s=E('select',{'id':'q-'+name,'data-q':name,'style':style||'width:180px'});
			if(!def)s.appendChild(E('option',{'value':''},hint?'-- ('+hint+')':'--'));
			var sv=val||def||'',known=false;
			opts.forEach(function(o){var a={'value':o};if(sv===o){a.selected='selected';known=true;}s.appendChild(E('option',a,o));});
			if(val&&!known)s.appendChild(E('option',{'value':val,'selected':'selected'},val+' (current)'));
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
			[txt('name',sn?(isDev?'':sn.name):'wan',isDev?'e.g. eth0':'e.g. wan','width:140px'),
			E('span',{'style':'opacity:.6;font-size:11px;margin-left:8px'},_('required — qosify skips sections with no name'))]);
		row(_('Bandwidth Up'),txt('bw_up',w.bandwidth_up,'e.g. 100mbit'));
		row(_('Bandwidth Down'),txt('bw_down',w.bandwidth_down,'e.g. 100mbit'));
		row(_('Overhead Type'),sel('overhead',w.overhead_type,OVH,'width:180px','none'));
		row(_('Overhead Bytes'),[txt('overhead_b',w.overhead,'manual only','width:100px'),
			E('span',{'style':'opacity:.6;font-size:11px;margin-left:8px'},_('used only when Overhead Type is manual'))]);
		row(_('Queue Mode'),sel('mode',w.mode,MODES,'width:170px',null,'diffserv4'));
		row(_('Ingress'),chk('ingress',w.ingress!=='0'));
		row(_('Egress'),chk('egress',w.egress!=='0'));
		// CAKE is only given nat/nonat when host_isolate is on; otherwise it gets
		// flow isolation and nat has no effect at all.
		var natCb=chk('nat',(w.nat==null||w.nat==='')?!isDev:(w.nat!=='0'));
		var hiCb=chk('host_isolate',w.host_isolate!=='0');
		var natNote=E('span',{'style':'opacity:.65;font-size:11px;margin-left:8px'},
			_('qosify only passes this to CAKE together with Host Isolate — add nat to Options to force it'));
		function syncNat(){
			natNote.style.display=hiCb.checked?'none':'';
		}
		hiCb.addEventListener('change',syncNat);
		syncNat();
		row(_('NAT'),[natCb,natNote]);
		row(_('Host Isolate'),hiCb);
		row(_('Autorate Ingress'),chk('autorate',w.autorate_ingress==='1'));
		row(_('Ingress Options'),txt('ing_opts',w.ingress_options,'e.g. triple-isolate memlimit 32mb','width:100%;max-width:400px;font-family:monospace'));
		row(_('Egress Options'),txt('egr_opts',w.egress_options,'e.g. triple-isolate memlimit 32mb wash','width:100%;max-width:400px;font-family:monospace'));
		row(_('Options'),txt('opts',w.options||w.option,'e.g. overhead 44 mpu 84','width:100%;max-width:400px;font-family:monospace'));
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
			'class':'cbi-button '+(ctx.enabled?'qos-btn-en':'qos-btn-dis'),
			'title':ctx.enabled?_('Click to disable autostart'):_('Click to enable autostart'),
			'click':function(){return self.svcAction(ctx.enabled?'disable':'enable');}
		},ctx.enabled?_('Enabled'):_('Disabled')));
		['start','stop','restart','reload'].forEach(function(a){
			svcCt.appendChild(E('button',{
				'class':'cbi-button cbi-button-'+(a==='stop'?'reset':'apply'),
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

	applyService:function(){
		var self=this;
		return callInit('qosify','restart').then(function(){
			return self.waitForRunning(4000);
		}).then(function(){
			return callInit('qosify','reload');
		});
	},

	updateEnBadge:function(el,ctx,enChecked){
		dom.content(el,'');
		if(ctx.active){el.className='qos-badge qos-green';dom.append(el,_('Active'));}
		else if(ctx.running&&enChecked){el.className='qos-badge qos-amber';dom.append(el,_('Enabled — Not Shaping (check config)'));}
		else if(enChecked){el.className='qos-badge qos-amber';dom.append(el,_('Enabled — Not Running'));}
		else{el.className='qos-badge qos-red';dom.append(el,_('Disabled'));}
	},

	renderSvcTable:function(ctx){
		function ok(t){return E('span',{'class':'qos-ok'},'\u2714 '+t);}
		function err(t){return E('span',{'class':'qos-err'},'\u2718 '+t);}
		function bdg(cls,t){return E('span',{'class':'qos-badge '+cls},t);}
		var tbl=E('table',{'class':'qos-kv','width':'100%','id':'qos-svc-tbl'});
		var b=E('tbody');tbl.appendChild(b);
		b.appendChild(E('tr',{},[E('td',{},_('Package')),E('td',{},ctx.hasBin?ok(_('Installed')):err(_('Not installed')))]));
		b.appendChild(E('tr',{},[E('td',{},_('Init Script')),E('td',{},ctx.hasInit?ok(_('Available')):err(_('Missing')))]));
		b.appendChild(E('tr',{},[E('td',{},_('Autostart')),E('td',{},bdg(ctx.enabled?'qos-green':'qos-red',ctx.enabled?_('Enabled'):_('Disabled')))]));
		var run;
		if(ctx.running&&ctx.active)run=bdg('qos-green',_('Running & Shaping'));
		else if(ctx.running)run=bdg('qos-amber',_('Running — Not Shaping'));
		else run=bdg('qos-red',_('Not Running'));
		b.appendChild(E('tr',{},[E('td',{},_('Running')),E('td',{},run)]));
		return tbl;
	},

	renderCfgFiles:function(ctx){
		var rulesN=countRules(ctx.rulesText);
		var cfgOk=ctx.cfgRaw.length>10&&/(^|\n)config /.test(ctx.cfgRaw);
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
		fileRow(RULES_PATH,!!ctx.rulesStat,rulesOk,ctx.rulesStat?ctx.rulesStat.size:0,ctx.rulesStat?fmtMtime(ctx.rulesStat.mtime):'',rulesN+' '+_('rules')+', ');
		return tbl;
	},

	tabConfig:function(ctx){
		var self=this;
		var section=E('div',{'class':'qos-tab','id':'qos-cf','style':'display:none'});
		var fs1=E('fieldset',{'class':'cbi-section'},[
			E('legend',{},_('Config')),
			E('div',{'class':'cbi-section-descr'},[_('UCI configuration — classes, interfaces, defaults.')+' ',E('code',{},UCI_PATH)])
		]);

		// Quick Add Config — built first so the reference table can be derived from it
		var classes=this.getClasses();
		var dscpChoices=classes.map(function(c){return c.name;}).concat(DSCP);
		var qa=E('div',{'class':'qos-qa'});
		qa.appendChild(E('strong',{'style':'font-size:13px;color:#aaa'},_('Quick Add Config')));
		var qacRow=E('div',{'class':'qos-qa-row'});
		var qacType=E('select',{'id':'qac-type','style':'width:130px','change':function(){self.qacSwitch();}});
		SECT.forEach(function(o){qacType.appendChild(E('option',{'value':o[0]},o[1]));});
		qacRow.appendChild(qacType);
		qacRow.appendChild(E('span',{'id':'qac-nm-w','style':'display:none'},
			E('input',{'id':'qac-name','type':'text','placeholder':'section name','style':'width:120px;font-family:monospace'})));
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
		var defBox=E('div',{'id':'qos-cfg-def','style':'margin:6px 0 4px;padding:4px 8px;border:1px solid #888;border-radius:3px'});
		dom.content(defBox,this.defsNodes());
		ref.appendChild(defBox);
		var clsBox=E('div',{'id':'qos-cfg-cls'});
		classes.forEach(function(c){
			var box=E('div',{'style':'margin:4px 0;padding:4px 8px;border:1px solid #888;border-radius:3px'});
			box.appendChild(E('strong',{'style':'font-size:12px'},clsLabel(c)));
			box.appendChild(E('span',{'style':'font-size:11px;opacity:.75;margin-left:8px'},clsDesc(c)));
			clsBox.appendChild(box);
		});
		ref.appendChild(clsBox);
		ref.appendChild(E('div',{'style':'opacity:.7;font-size:11px;margin:4px 0 2px'},
			_('DSCP codepoints: CS0–CS7, AF11–AF43, EF, VA, NQB, LE, DF. Any dscp_* value may also name a class. Prefix with + to override only when the DSCP field is zero.')));
		ref.appendChild(E('div',{'style':'opacity:.7;font-size:11px;margin:2px 0'},
			_('Defaults qosify applies when a key is absent — interface: mode diffserv4, ingress 1, egress 1, nat 1, host_isolate 1, autorate_ingress 0. device: identical except nat 0. defaults: timeout 3600, dscp_default_tcp/udp CS0, dscp_prio/dscp_bulk/dscp_icmp unset, bulk_trigger_pps/bulk_trigger_timeout/prio_max_avg_pkt_len 0 (disabled).')));
		fs1.appendChild(ref);
		fs1.appendChild(qa);

		// Editor
		var ta=E('textarea',{
			'id':'qos-config-ta',
			'rows':28,
			'style':'width:100%;font-family:monospace;font-size:12px;line-height:1.4;tab-size:4;border:1px solid #ccc;padding:6px'
		},ctx.cfgRaw);
		ta.dataset.orig=ctx.cfgRaw;
		fs1.appendChild(ta);
		fs1.appendChild(E('div',{'class':'cbi-page-actions'},[
			E('button',{'class':'cbi-button cbi-button-reset','style':'margin-right:6px','click':function(){return self.clearCfg();}},_('Clear')),
			E('button',{'class':'cbi-button cbi-button-apply','click':function(){return self.saveConfig();}},_('Save & Apply'))
		]));

		section.appendChild(fs1);
		return section;
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
					note[o[0]]?E('div',{'style':'opacity:.65;font-size:11px;margin-top:3px'},note[o[0]]):''
				])
			]));
		});
		return tbl;
	},

	qaInput:function(parent,opt,pre,ph,w){
		parent.appendChild(E('label',{},opt+':'));
		parent.appendChild(E('input',{
			'data-opt':opt,'data-pre':pre,'type':'text',
			'value':pre==='list'?ph:'','placeholder':pre==='list'?'':ph,
			'style':'width:'+w+'px;font-family:monospace'
		}));
	},
	qaSelect:function(parent,opt,opts,w,required){
		parent.appendChild(E('label',{},opt+':'));
		var s=E('select',{'data-opt':opt,'style':'width:'+w+'px'});
		if(!required)s.appendChild(E('option',{'value':''},'--'));
		opts.forEach(function(o){s.appendChild(E('option',{'value':o},o));});
		parent.appendChild(s);
	},
	qaNum:function(parent,opt,ph,w){
		parent.appendChild(E('label',{},opt+':'));
		parent.appendChild(E('input',{'data-opt':opt,'type':'number','min':'0','placeholder':ph,'style':'width:'+w+'px'}));
	},

	lock:function(){this._n=(this._n||0)+1;},
	unlock:function(){this._n=Math.max(0,(this._n||0)-1);},

	defsNodes:function(){
		var d=null;
		uci.sections('qosify','defaults',function(s){if(!d)d=s;});
		if(!d)return [E('em',{'style':'font-size:11px;opacity:.7'},_('No config defaults section defined'))];
		var keys=['timeout','dscp_default_tcp','dscp_default_udp','dscp_icmp','dscp_prio','dscp_bulk','prio_max_avg_pkt_len','bulk_trigger_pps','bulk_trigger_timeout'];
		var line=E('div',{'style':'font-size:11px;margin:2px 0 0;font-family:monospace'}),parts=[];
		keys.forEach(function(k){if(d[k])parts.push(k+': <strong>'+esc(d[k])+'</strong>');});
		line.innerHTML=parts.join(' &nbsp; ');
		return [E('strong',{'style':'font-size:12px'},'config defaults'),line];
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
				ref.appendChild(E('tr',{},E('td',{'colspan':2,'style':'opacity:.7'},E('em',{},_('No classes defined in /etc/config/qosify')))));
			}
		}
		var cbox=$('qos-cfg-cls');
		if(cbox){
			dom.content(cbox,'');
			classes.forEach(function(c){
				var box=E('div',{'style':'margin:4px 0;padding:4px 8px;border:1px solid #888;border-radius:3px'});
				box.appendChild(E('strong',{'style':'font-size:12px'},clsLabel(c)));
				box.appendChild(E('span',{'style':'font-size:11px;opacity:.75;margin-left:8px'},clsDesc(c)));
				cbox.appendChild(box);
			});
		}
	},

	tabRules:function(ctx){
		var self=this;
		var section=E('div',{'class':'qos-tab','id':'qos-ru','style':'display:none'});
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
			refB.appendChild(E('tr',{},E('td',{'colspan':2,'style':'opacity:.7'},E('em',{},_('No classes defined in /etc/config/qosify')))));
		}
		ref.appendChild(refTbl);
		ref.appendChild(E('div',{'style':'opacity:.7;font-size:11px;margin:6px 0 2px'},
			_('Prefix with + to override only when the DSCP field is zero. Ports: tcp:443, udp:3074, ranges: tcp:5060-5061 (1-65534). DNS: dns:*teams*, regex: dns:/zoom[0-9]+, CNAME-only: dns_c:. IP: 1.1.1.1, ff01::1')));
		fs1.appendChild(ref);

		// Quick Add Rule
		var qa=E('div',{'class':'qos-qa'});
		qa.appendChild(E('strong',{'style':'font-size:13px;color:#aaa'},_('Quick Add Rule')));
		var qarRow=E('div',{'class':'qos-qa-row'});
		var qarType=E('select',{'id':'qar-type','style':'width:140px','change':function(){self.qarPlaceholder();}});
		[['tcp:',_('tcp port')],['udp:',_('udp port')],['both:',_('tcp+udp port')],['dns:',_('dns pattern')],['dnsr:',_('dns regex')],['dns_c:',_('dns_c pattern')],['dns_cr:',_('dns_c regex')],['ipv4:',_('IPv4 address')],['ipv6:',_('IPv6 address')]].forEach(function(o){
			qarType.appendChild(E('option',{'value':o[0]},o[1]));
		});
		qarRow.appendChild(qarType);
		qarRow.appendChild(E('input',{'id':'qar-val','type':'text','placeholder':'e.g. 4500 or 5060-5061','style':'width:180px;font-family:monospace'}));
		var qarCls=E('select',{'id':'qar-cls','style':'width:140px'});
		classes.forEach(function(c){qarCls.appendChild(E('option',{'value':c.name},c.name));});
		qarRow.appendChild(qarCls);
		qarRow.appendChild(E('label',{'style':'font-size:12px;color:#aaa;white-space:nowrap'},
			[E('input',{'type':'checkbox','id':'qar-prio'}),' '+_('only if unset (+)')]));
		qarRow.appendChild(E('button',{'class':'cbi-button cbi-button-add','click':function(){return self.qarAdd();}},_('Add')));
		qa.appendChild(qarRow);
		fs1.appendChild(qa);

		// Editor
		var ta=E('textarea',{
			'id':'qos-rules-ta','rows':28,
			'style':'width:100%;font-family:monospace;font-size:12px;line-height:1.4;tab-size:4;border:1px solid #ccc;padding:6px'
		},ctx.rulesText);
		ta.dataset.orig=ctx.rulesText;
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
		var section=E('div',{'class':'qos-tab','id':'qos-ad','style':'display:none'});

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
				E('button',{'class':'cbi-button cbi-button-action','click':function(){
					L.resolveDefault(fs.read(path),'').then(function(content){
						var b=new Blob([content||''],{type:'application/octet-stream'});
						var a=document.createElement('a');
						a.href=URL.createObjectURL(b);a.download=fn;a.click();URL.revokeObjectURL(a.href);
					});
				}},_('Download')))
		]);
	},

	tabStatus:function(ctx){
		var section=E('div',{'class':'qos-tab','id':'qos-st','style':'display:none'});
		var fs1=E('fieldset',{'class':'cbi-section'},E('legend',{},_('qosify-status')));
		var body=E('div',{'id':'qos-st-body'});
		this.fillStatus(body,ctx);
		fs1.appendChild(body);
		section.appendChild(fs1);
		return section;
	},

	lintAll:function(){
		var out=[];
		function walk(type,dev){
			uci.sections('qosify',type,function(s){
				if(s.disabled==='1')return;
				ifLint(s,dev).forEach(function(t){out.push(s['.name']+': '+t);});
			});
		}
		walk('interface',false);
		walk('device',true);
		return out;
	},

	fillStatus:function(body,ctx){
		dom.content(body,'');
		if(!ctx.running){
			body.appendChild(E('div',{'class':'alert-message warning'},_('qosify is not running. Start from the Overview tab.')));
		}else if(!ctx.qstatus){
			body.appendChild(E('p',{'style':'opacity:.7'},E('em',{},_('qosify-status returned no output.'))));
		}else{
			body.appendChild(E('pre',{'style':'background:#1e1e1e;color:#e0e0e0;padding:12px;border:1px solid #333;border-radius:4px;overflow-x:auto;font-size:12px;line-height:1.5;white-space:pre-wrap'},ctx.qstatus));
		}
	},

	// === Actions ===

	svcAction:function(action){
		var self=this;
		self.lock();
		ui.showModal(_('Working'),[E('p',{},_('Sending %s to qosify...').format(action))]);
		var p=callInit('qosify',action);
		if(action==='start'||action==='restart')
			p=p.then(function(){return self.waitForRunning(4000);}).then(function(){return callInit('qosify','reload');});
		if(action==='stop')
			p=p.then(function(){return L.resolveDefault(fs.exec('/usr/share/qosify-luci/cleanup',[]),null);});
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
		var bw=function(s){return (s||'').toLowerCase().replace(/\s+/g,'');};
		var bwUp=bw(get('bw_up')),bwDn=bw(get('bw_down'));
		var ovh=get('overhead'),mode=get('mode'),ovhB=trim(get('overhead_b'));
		var iopts=trim(get('ing_opts')),eopts=trim(get('egr_opts')),gopts=trim(get('opts'));
		var safe=/^[\w\s.:-]*$/;
		if(!safe.test(iopts)||!safe.test(eopts)||!safe.test(gopts)){
			notify(_('Error: invalid characters in options fields. Use alphanumeric, spaces, hyphens, dots, colons only.'),'danger');
			return;
		}
		if(bwUp&&!/^\d+(\.\d+)?[kmg]?bit$/.test(bwUp)){notify(_('Error: bandwidth_up must look like 100mbit'),'danger');return;}
		if(bwDn&&!/^\d+(\.\d+)?[kmg]?bit$/.test(bwDn)){notify(_('Error: bandwidth_down must look like 100mbit'),'danger');return;}
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
		return L.resolveDefault(callUciRevert('qosify'),null).then(function(){
			return L.resolveDefault(fs.read(UCI_PATH),'');
		}).then(function(txt){
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

	saveConfig:function(){
		var self=this;
		var ta=$('qos-config-ta');
		if(!ta)return;
		var data=ta.value.replace(/\r\n/g,'\n');
		if(data.length===0){
			if(!confirm(_('Empty config will stop qosify. Continue?')))return;
			self.lock();
			return L.resolveDefault(callUciRevert('qosify'),null).then(function(){
				return fs.write(UCI_PATH,'');
			}).then(function(){
				return callInit('qosify','stop');
			}).then(function(){
				return L.resolveDefault(fs.exec('/usr/share/qosify-luci/cleanup',[]),null);
			}).then(function(){
				uci.unload('qosify');
				return uci.load('qosify');
			}).then(function(){
				ta.dataset.orig='';
				notify(_('Config cleared, qosify stopped.'),'info');
				return self.refreshAll();
			}).catch(function(e){
				notify(_('Save failed: %s').format(e),'danger');
			}).finally(function(){self.unlock();});
		}
		if(!/(^|\n)config /.test(data)){
			notify(_('Error: No valid config stanzas found.'),'danger');return;
		}
		self.lock();
		ui.showModal(_('Saving'),[E('p',{},_('Writing config and reloading qosify...'))]);
		return L.resolveDefault(callUciRevert('qosify'),null).then(function(){
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
			return self.refreshAll();
		}).catch(function(e){
			ui.hideModal();
			notify(_('Save failed: %s').format(e),'danger');
		}).finally(function(){self.unlock();});
	},

	waitForShaping:function(tries){
		var self=this;
		return L.resolveDefault(fs.exec('/usr/sbin/qosify-status',[]),{stdout:''}).then(function(r){
			var st=r.stdout||'';
			if(detectActive(st)||tries<=1)return st;
			return new Promise(function(res){setTimeout(res,700);}).then(function(){return self.waitForShaping(tries-1);});
		});
	},

	checkShapingForSave:function(prefix){
		var sn=ifSect(),w=(sn&&uci.get('qosify',sn.id))||{};
		if(w.disabled==='1')return Promise.resolve({text:_('%s, applied (QoS disabled).').format(prefix),kind:'info'});
		return this.waitForShaping(3).then(function(st){
			if(detectActive(st))return {text:_('%s, applied.').format(prefix),kind:'info'};
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
			if(rwarn)notify(rwarn,'warning');
			return self.refreshAll();
		}).catch(function(e){
			ui.hideModal();
			notify(_('Save failed: %s').format(e),'danger');
		}).finally(function(){self.unlock();});
	},

	clearCfg:function(){
		if(!confirm(_('Clear config editor? Content will not be saved until you click Save.')))return;
		var ta=$('qos-config-ta');if(ta)ta.value='';
	},
	clearRules:function(){
		if(!confirm(_('Clear rules editor? Content will not be saved until you click Save.')))return;
		var ta=$('qos-rules-ta');if(ta)ta.value='';
	},

	uploadFiles:function(){
		var self=this;
		var u1=$('qos-up-cfg'),u2=$('qos-up-rules');
		var f1=u1&&u1.files[0],f2=u2&&u2.files[0];
		if(!f1&&!f2){notify(_('No files selected.'),'warning');return;}
		if(!confirm(_('Upload and overwrite config files? qosify will reload.')))return;

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
			return L.resolveDefault(callUciRevert('qosify'),null).then(function(){
				return fs.write(UCI_PATH,d);
			}).then(function(){
				names.push('/etc/config/qosify');
				uci.unload('qosify');
				return uci.load('qosify');
			});
		},function(e){errs.push(_('Config: %s').format(e));});});
		if(f2)p=p.then(function(){return readFile(f2).then(function(d){
			var e=validateRules(d);
			if(e){errs.push(_('Rules: %s').format(e));return null;}
			var w=ruleWarn(d,self.getClasses().map(function(c){return c.name;}));
			if(w)warns.push(w);
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
				if(warns.length)notify(warns.join('; '),'warning');
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
		if(!confirm(_('Reset qosify config to defaults?')))return;
		self.lock();
		ui.showModal(_('Resetting'),[E('p',{},_('Restoring defaults...'))]);
		return L.resolveDefault(callUciRevert('qosify'),null).then(function(){
			return Promise.all([
				fs.read('/usr/share/qosify-luci/qosify'),
				fs.read('/usr/share/qosify-luci/00-defaults.conf')
			]);
		}).then(function(t){
			return Promise.all([
				fs.write(UCI_PATH,t[0]),
				fs.write(RULES_PATH,t[1])
			]);
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
		var ph={'tcp:':'e.g. 4500 or 5060-5061','udp:':'e.g. 4500 or 5060-5061','both:':'e.g. 4500 or 5060-5061',
			'dns:':'e.g. *teams* or *.zoom*','dnsr:':'e.g. zoom[0-9]+\\.us','dns_c:':'e.g. *cdn*','dns_cr:':'e.g. cdn[0-9]+',
			'ipv4:':'e.g. 1.1.1.1','ipv6:':'e.g. ff01::1'};
		v.placeholder=ph[t]||'';
	},

	qarAdd:function(){
		var ty=$('qar-type').value;
		var val=trim($('qar-val').value);
		var cls=$('qar-cls').value;
		var pr=$('qar-prio').checked;
		if(!val){alert(_('Enter a value.'));return;}
		if(!cls){alert(_('No classes defined. Add classes in the Config tab first.'));return;}
		var pt=(ty==='tcp:'||ty==='udp:'||ty==='both:');
		if(pt&&!/^\d+(-\d+)?$/.test(val)){alert(_('Port must be a number or range (e.g. 4500 or 5060-5061).'));return;}
		if(pt){
			var pp=val.split('-');
			for(var j=0;j<pp.length;j++){var n=parseInt(pp[j]);if(n<1||n>65534){alert(_('Port must be 1-65534 (qosify rejects 65535).'));return;}}
			if(pp.length===2&&+pp[0]>+pp[1]){alert(_('Range start must not exceed end.'));return;}
		}else if(/[\s#]/.test(val)){alert(_('No spaces or # allowed in patterns or addresses.'));return;}
		if(ty==='ipv4:'){
			var oc=val.split('.');
			if(oc.length!==4||oc.some(function(x){return !/^\d{1,3}$/.test(x)||+x>255;})){alert(_('Enter a single IPv4 address (qosify does not accept CIDR).'));return;}
		}
		if(ty==='ipv6:'&&(!/^[0-9a-fA-F:]+$/.test(val)||val.indexOf(':')<0||val.length>45)){alert(_('Enter a single IPv6 address (qosify does not accept CIDR).'));return;}
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
		var nm='';
		if(ty!=='defaults'){
			nm=$('qac-name').value.replace(/[^a-zA-Z0-9_]/g,'');
			if(!nm){alert(_('Enter a section name (alphanumeric/underscore).'));return;}
		}
		if(ty==='defaults'&&/(^|\n)\s*config\s+defaults\s*$/.test(ta.value)){alert(_('A config defaults section already exists.'));return;}
		if(nm&&new RegExp("(^|\\n)\\s*config\\s+"+ty+"\\s+'?"+nm+"'?\\s*$","m").test(ta.value)){alert(_('Section %s already exists.').format(nm));return;}
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

	gatherCtx:function(){
		return Promise.all([
			L.resolveDefault(fs.read(UCI_PATH),''),
			L.resolveDefault(fs.read(RULES_PATH),''),
			L.resolveDefault(fs.stat(UCI_PATH),null),
			L.resolveDefault(fs.stat(RULES_PATH),null),
			L.resolveDefault(callServiceList('qosify'),{}),
			L.resolveDefault(fs.exec('/etc/init.d/qosify',['enabled']),{code:1}),
			L.resolveDefault(fs.stat('/usr/sbin/qosify'),null),
			L.resolveDefault(fs.stat('/etc/init.d/qosify'),null),
			L.resolveDefault(fs.exec('/usr/sbin/qosify-status',[]),{stdout:''})
		]).then(function(d){
			var ctx={
				cfgRaw:d[0]||'',rulesText:d[1]||'',
				cfgStat:d[2],rulesStat:d[3],
				running:isRunning(d[4]),enabled:d[5].code===0,
				hasBin:d[6]!=null,hasInit:d[7]!=null,
				qstatus:(d[8]&&d[8].stdout)||''
			};
			ctx.active=detectActive(ctx.qstatus);
			return ctx;
		});
	},

	refreshOverview:function(){
		var self=this;
		self.lock();
		uci.unload('qosify');
		return uci.load('qosify').then(function(){
			return self.gatherCtx();
		}).then(function(ctx){
			self.fillSect('qos-svc-sect',self.buildSvcSect(ctx));
			self.fillSect('qos-cfg-sect',self.buildCfgSect(ctx));
			self.fillSect('qos-ctl-sect',self.buildCtlSect(ctx));
			var stb=$('qos-st-body');
			if(stb)self.fillStatus(stb,ctx);
			var bd=$('q-en-badge');
			if(bd){
				var sn=ifSect(),w=(sn&&uci.get('qosify',sn.id))||{};
				self.updateEnBadge(bd,ctx,w['.name']!=null&&w.disabled!=='1');
			}
			return ctx;
		}).finally(function(){self.unlock();});
	},

	refreshOverviewFull:function(){
		var self=this;
		return self.refreshOverview().then(function(ctx){
			self.fillSect('qos-qs-sect',self.buildQsSect(ctx));
			return ctx;
		});
	},

	refreshStatus:function(){
		if(this.currentTab!=='st')return;
		var self=this;
		return Promise.all([
			L.resolveDefault(callServiceList('qosify'),{}),
			L.resolveDefault(fs.exec('/usr/sbin/qosify-status',[]),{stdout:''})
		]).then(function(d){
			var ctx={running:isRunning(d[0]),qstatus:(d[1]&&d[1].stdout)||''};
			var stb=$('qos-st-body');
			if(stb)self.fillStatus(stb,ctx);
		});
	},

	refreshAll:function(){
		var self=this;
		return self.refreshOverviewFull().then(function(){
			self.refreshClasses();
			return Promise.all([
				L.resolveDefault(fs.read(UCI_PATH),''),
				L.resolveDefault(fs.read(RULES_PATH),'')
			]);
		}).then(function(d){
			var c=$('qos-config-ta'),r=$('qos-rules-ta'),lost=false;
			if(c){
				if(c.dataset.orig!=null&&c.value!==c.dataset.orig&&c.value!==(d[0]||''))lost=true;
				c.value=d[0]||'';c.dataset.orig=c.value;
			}
			if(r){
				if(r.dataset.orig!=null&&r.value!==r.dataset.orig&&r.value!==(d[1]||''))lost=true;
				r.value=d[1]||'';r.dataset.orig=r.value;
			}
			if(lost)notify(_('Editors reloaded from disk — unsaved editor changes were discarded.'),'warning');
		});
	}
});
