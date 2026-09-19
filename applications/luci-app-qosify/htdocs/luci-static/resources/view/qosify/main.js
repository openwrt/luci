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
var MAP_ROWS=200;
// Bar length is (row/largest row)^BAR_EXP: the largest row fills the track and a
// 0.1% row still shows at a tenth of it, so a bulk download does not hide the rest.
var BAR_EXP=1/3;
// codepoints[] in map.c.
var DSCP_VAL={CS0:0,DF:0,LE:1,CS1:8,AF11:10,AF12:12,AF13:14,CS2:16,AF21:18,AF22:20,
	AF23:22,CS3:24,AF31:26,AF32:28,AF33:30,CS4:32,AF41:34,AF42:36,AF43:38,CS5:40,
	VA:44,NQB:45,EF:46,CS6:48,CS7:56};
// Counters order: EF first, then codepoint descending. LE (1) and CS1 (8) are
// CAKE's Background tin, so they sort below best effort; -1 is anything
// __qosify_map_dscp_value() would reject and sorts below them.
var DSCP_BULK={1:1,8:1};
// Within an AF class the lowest drop precedence leads: AF41, AF42, AF43.
function dscpRank(v){return v<0?-1000:DSCP_BULK[v]?v-100:v===46?100:v>=10&&v<=38&&!(v&1)&&(v&7)?(v&56)+8-(v&7):v;}
// Colour by sorted class name, so a class keeps its colour as the bars reorder.
function qc(n){return 'var(--qos-c-'+n+')';}
var CN_COLORS=['blue','green','orange','purple','red','cyan','brown','pink'].map(qc);
// qosify_map_stats() appends these two default slots; they are not config classes.
var CN_SKIP={tcp_default:1,udp_default:1};
// A class with no codepoint to place in a tin.
var CN_NONE=qc('none');
// CAKE's DSCP to tin tables in sch_cake.c, already put through tin_order, so each
// digit is the column qosify-status prints that tin in. besteffort is one tin.
var TIN_MAP={besteffort:'0',
	precedence:'0000000011111111222222223333333344444444555555556666666677777777',
	diffserv8:'2012422212121212524242423232323262323232622262627222222272222222',
	diffserv4:'1011211101111111212121212121212131212121311131313111111131111111',
	diffserv3:'1011211101111111111111111111111111111111111121212111111121111111'};
// Colour per tin, same index as TIN_MAP and the qosify-status tin columns, so a
// class bar takes the colour of the tin its codepoint lands in. One colour per kind
// of traffic across modes: red bulk, blue best effort, yellow video, green voice;
// diffserv8 and precedence add their extra tins between them. The names are
// qosify.css tokens, so the theme supplies the colours in light and dark.
var TIN_COLORS={besteffort:['blue'],
	precedence:['blue','red','purple','yellow','orange','green','forest','pine'],
	diffserv8:['grey','red','blue','yellow','cyan','purple','green','forest'],
	diffserv4:['red','blue','yellow','green'],
	diffserv3:['red','blue','green']};
for(var tk in TIN_COLORS)TIN_COLORS[tk]=TIN_COLORS[tk].map(qc);
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
// rc.list, service.list and qosify.status raise. Without reject:true a ubus
// status code (6 when the ACL no longer covers the object, 4 when it is gone)
// stays in result[0] and expect{'':{}} rewrites it to the same {} a working
// call with nothing to report returns, so a call that never ran cannot be told
// from one that ran and found nothing. Each site catches the rejection to null.
// skip_running_check keeps rc.list from forking `qosify running`, which waits
// on ubus for up to 10s while rpcd kills it after 3s.
var callRcList=rpc.declare({
	object:'rc',
	method:'list',
	params:['name','skip_running_check'],
	expect:{'':{}},
	reject:true
});
var callQosifyStatus=rpc.declare({
	object:'qosify',
	method:'status',
	expect:{'':{}},
	reject:true
});
// reload re-reads the files in the defaults list (qosify_map_reload()) and
// nothing else; check_devices re-runs qosify_iface_check(). Both return an
// empty reply, so without reject:true a failure would read as success.
var callQosifyReload=rpc.declare({
	object:'qosify',
	method:'reload',
	reject:true
});
var callQosifyCheckDevices=rpc.declare({
	object:'qosify',
	method:'check_devices',
	reject:true
});
// get_stats and dump are in qosify 1501e09 (24.10, 25.12) and master; the
// get_stats reply shape differs by build and is rendered as found.
var callQosifyStats=rpc.declare({
	object:'qosify',
	method:'get_stats',
	expect:{'':{}},
	reject:true
});
var callQosifyDump=rpc.declare({
	object:'qosify',
	method:'dump',
	expect:{'':{}},
	reject:true
});
var callServiceList=rpc.declare({
	object:'service',
	method:'list',
	params:['name'],
	expect:{'':{}},
	reject:true
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
function runPid(r){
	try{var i=r.qosify.instances;for(var k in i)if(i[k].running&&i[k].pid)return i[k].pid;}catch(e){}
	return 0;
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
function fmtShare(p){
	if(!p)return '0%';
	if(p<0.1)return '<0.1%';
	return _('%s%%').format(p<10?p.toFixed(1):Math.round(p));
}

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
// Stock LuCI markup: themes style .cbi-section, .table, .label and
// .cbi-value already, so qosify.css only draws the section boxes.
function badge(kind,t){return E('span',{'class':kind?'label '+kind:'label'},t);}
function desc(t){return E('div',{'class':'cbi-value-description'},t);}
function sdesc(t){return E('div',{'class':'cbi-section-descr'},t);}
function kvRow(k,v,id){return E('tr',{'class':'tr'},[E('td',{'class':'td left','width':'33%'},k),E('td',{'class':'td left','id':id||null},v)]);}
function kvTable(rows,id){return E('table',{'class':'table','id':id||null},rows);}
function emRow(t){return E('tr',{'class':'tr placeholder'},E('td',{'class':'td'},E('em',{},t)));}
function emP(t){return E('p',{},E('em',{},t));}
function gridTable(head,rows){
	return E('table',{'class':'table cbi-section-table'},[E('tr',{'class':'tr cbi-section-table-titles'},head.map(function(h){return E('th',{'class':'th'},h);}))]
		.concat(rows.map(function(r){return E('tr',{'class':'tr cbi-section-table-row'},r.map(function(c,i){return E('td',{'class':'td','data-title':head[i]},c);}));})));
}
function sect(title,kids,attrs){
	var a=attrs||{};
	a['class']='cbi-section';
	return E('div',a,[E('h3',{'id':a.id?a.id+'-title':null},title)].concat(kids||[]));
}
function colTable(cols,kids){
	var sum=cols.reduce(function(t,c){return t+c[1];},0);
	return E('table',{'class':'table','style':'table-layout:fixed'},[E('colgroup',{},cols.map(function(c){
		return E('col',{'style':'width:'+(c[1]*100/sum).toFixed(2)+'%'});}))].concat(kids));
}
function colHead(cols,id){
	return E('div',{'class':'qhead','id':id||null},colTable(cols,E('tr',{'class':'tr table-titles'},
		cols.map(function(c){return E('th',{'class':c[2]?'th qn':'th left'},c[0]);}))));
}
function valRow(lbl,el){
	var n=Array.isArray(el)?el[0]:el;
	return E('div',{'class':'cbi-value'},[E('label',{'class':'cbi-value-title','for':(n&&n.id)||null},lbl),E('div',{'class':'cbi-value-field'},el)]);
}

function noClassRow(){
	return emRow(_('No classes defined in %s').format(UCI_PATH));
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

		var names={ov:'overview',cf:'config',ru:'rules',ad:'advanced',st:'status',cn:'counters'};
		var hash=(location.hash||'').slice(1),want='ov',k;
		for(k in names)if(names[k]===hash)want=k;

		var group=E('div',{});
		[['ov',_('Overview'),this.tabOverview(ctx)],
		 ['cf',_('Config'),this.tabConfig(ctx)],
		 ['ru',_('Classification Rules'),this.tabRules(ctx)],
		 ['st',_('Status'),this.tabStatus(ctx)],
		 ['cn',_('Counters'),this.tabCounters(ctx)],
		 ['ad',_('Advanced'),this.tabAdvanced(ctx)]].forEach(function(t){
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
				if(t[0]==='cn')self.refreshCounters();
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

	// Both tabs tick at luci.main.pollinterval, each only while its tab is open.
	// Overview is six ubus calls and no forks; Status forks qosify-status, which
	// runs tc twice per active interface, so a slow box raises that interval.
	// Poll.step() holds the next tick until the promise this returns settles, and
	// refreshStatus() drops a call overlapping the one fired on tab open, so a
	// fork slower than the interval skips ticks instead of stacking up.
	installPollers:function(){
		var self=this;
		poll.add(function(){if(self.currentTab!=='ov'||self._n)return;return self.refreshOverview();});
		poll.add(function(){if(self.currentTab!=='st'||self._n)return;return self.refreshStatus();});
		poll.add(function(){if(self.currentTab!=='cn'||self._n)return;return self.refreshCounters();});
	},

	tabOverview:function(ctx){
		return E('div',{'id':'qos-ov'},[
			E('div',{'class':'cbi-section','id':'qos-svc-sect'},this.buildSvcSect(ctx)),
			E('div',{'class':'cbi-section','id':'qos-qs-sect'},this.buildQsSect(ctx)),
			E('div',{'class':'cbi-section','id':'qos-cfg-sect'},this.buildCfgSect(ctx)),
			this.buildSvcActs(ctx)
		]);
	},

	buildSvcSect:function(ctx){
		return [E('h3',{},_('Service')),this.renderSvcTable(ctx)];
	},

	buildCfgSect:function(ctx){
		return [E('h3',{},_('Files')),this.renderCfgFiles(ctx)];
	},

	buildQsSect:function(ctx){
		var self=this;
		var sn=ifSect();
		var w=(sn&&uci.get('qosify',sn.id))||{};
		var enChecked=(w['.name']!=null&&!uciBool(w.disabled,false));

		var nodes=[];
		nodes.push(E('h3',{},_('Quick Settings')));
		nodes.push(sdesc(
			_('Common shaping settings — written straight to %s, section %s.').format(UCI_PATH,sn?'config '+sn.type+(sn.name?" '"+sn.name+"'":' '+_('(unnamed section)')):"config interface 'wan' (will be created)")));
		var tbl=E('div',{'class':'cbi-section-node'});

		function row(lbl,el){tbl.appendChild(valRow(lbl,el));}
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
		var enBadge=badge('warning','');
		enBadge.id='q-en-badge';
		this.updateEnBadge(enBadge,ctx,enChecked);
		row(_('QoS Enabled'),[enCb,' ',enBadge]);
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
			desc(_('required — qosify skips sections with no name'))]);
		row(_('Bandwidth Up'),txt('bw_up',w.bandwidth_up,_('e.g. %s').format('100mbit')));
		row(_('Bandwidth Down'),txt('bw_down',w.bandwidth_down,_('e.g. %s').format('100mbit')));
		row(_('Overhead Type'),sel('overhead',w.overhead_type,OVH,'width:180px','none'));
		row(_('Overhead Bytes'),[txt('overhead_b',w.overhead,_('manual only'),'width:100px'),
			desc(_('used only when Overhead Type is manual'))]);
		row(_('Queue Mode'),sel('mode',w.mode,MODES,'width:170px',null,'diffserv4'));
		row(_('Ingress'),chk('ingress',numBool(w.ingress,true)));
		row(_('Egress'),chk('egress',numBool(w.egress,true)));
		// CAKE is only given nat/nonat when host_isolate is on; otherwise it gets
		// flow isolation and nat has no effect at all.
		var natCb=chk('nat',numBool(w.nat,!isDev));
		var hiCb=chk('host_isolate',numBool(w.host_isolate,true));
		var natNote=desc(_('qosify only passes this to CAKE together with Host Isolate — add nat to Options to force it'));
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

	// The controls sit once, at the bottom of Overview, rather than under every tab.
	buildSvcActs:function(ctx){
		var self=this,acts=E('div',{'class':'cbi-page-actions','id':'qos-svc-btns'},
			E('button',{'id':'qos-btn-auto','click':function(){return self.svcAction(self._auto?'disable':'enable');}}));
		// Reload is the init script's reload_service(), a full ubus config push.
		// Reload Rules re-reads the mapping files alone and leaves the qdiscs and
		// interface config untouched -- what a rules edit actually needs.
		[['start','cbi-button-apply',_('Start')],['restart','cbi-button-action',_('Restart')],
		 ['reload','cbi-button-reload',_('Reload')],['maps','cbi-button-reload',_('Reload Rules'),1],
		 ['stop','cbi-button-negative',_('Stop')]].forEach(function(b){
			acts.appendChild(document.createTextNode(' '));
			acts.appendChild(E('button',{'class':'cbi-button '+b[1],'id':'qos-btn-'+b[0],'title':b[3]?_('Re-read the mapping files only'):null,
				'click':function(){return b[3]?self.mapReload():self.svcAction(b[0]);}},b[2]));
		});
		this.svcButtons(ctx,acts);
		return acts;
	},

	// Buttons that do not apply to the current state are disabled. Unknown is not
	// Missing: with the state unknown the actions stay clickable, so a stale ACL
	// answers with the call's own error instead of a bar of dead buttons.
	svcButtons:function(ctx,root){
		var ro=this.readonly||ctx.hasInit===false,un=ctx.running==null,b,
			g=function(id){return root?root.querySelector('#'+id):$(id);};
		if((b=g('qos-btn-auto')))this.autoButton(ctx,b);
		[['start',!ctx.running],['restart',ctx.running],['reload',ctx.running],['stop',ctx.running]].forEach(function(x){
			if((b=g('qos-btn-'+x[0])))b.disabled=ro||!(un||x[1]);
		});
		// Reload Rules is a ubus call, so it needs the daemon up but not the init script.
		if((b=g('qos-btn-maps')))b.disabled=this.readonly||ctx.running===false;
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
		if(ctx.active==null){el.className='label warning';dom.content(el,_('Status Unknown'));}
		else if(ctx.active){el.className='label success';dom.content(el,_('Active'));}
		else if(ctx.running&&enChecked){el.className='label warning';dom.content(el,_('Enabled — Not Shaping (check config)'));}
		else if(enChecked){el.className='label warning';dom.content(el,_('Enabled — Not Running'));}
		else{el.className='label danger';dom.content(el,_('Disabled'));}
	},

	svcNodes:function(ctx){
		// Unknown is not Missing: a call rpcd did not answer says nothing about qosify.
		function tri(v,f){return v==null?badge('warning',_('Unknown')):f(v);}
		var run;
		if(ctx.running==null)run=badge('warning',_('Unknown'));
		else if(ctx.running&&ctx.active==null)run=badge('warning',_('Running — Shaping Unknown'));
		else if(ctx.running&&ctx.active)run=badge('success',_('Running & Shaping'));
		else if(ctx.running)run=badge('warning',_('Running — Not Shaping'));
		else run=badge('danger',_('Not Running'));
		// One line for the condition behind every Unknown in the table, rather than
		// the same note repeated on each row it reaches.
		if(ctx.rpcOk===false)run=[run,' ',
			_('rpcd is not answering for qosify — check the ACL in /usr/share/rpcd/acl.d and restart rpcd')];
		return {
			up:ctx.uptime!=null?'%t'.format(Math.floor(ctx.uptime)):'-',
			init:tri(ctx.hasInit,function(v){return badge(v?'success':'danger',v?_('Available'):_('Missing'));}),
			auto:tri(ctx.enabled,function(v){return badge(v?'success':'danger',v?_('Enabled'):_('Disabled'));}),
			run:run,
			shaped:tri(ctx.shaped,function(v){return v?N_(v,'%d interface','%d interfaces').format(v):E('em',{},_('none'));})
		};
	},

	// Status, then the per-interface rows from ubus call qosify status, which cost
	// no forks, then the init script.
	renderSvcTable:function(ctx){
		var n=this.svcNodes(ctx),rows=[
			kvRow(_('Status'),n.run),
			kvRow(_('Uptime'),n.up),
			kvRow(_('Autostart'),n.auto),
			kvRow(_('Shaping'),n.shaped)
		];
		['interfaces','devices'].forEach(function(g){
			var t=ctx.status&&ctx.status[g],k,e;
			for(k in t){
				e=t[k]||{};
				rows.push(kvRow((g==='devices'?_('device %s'):_('interface %s')).format(k),[
					badge(e.active?'success':'danger',e.active?_('active'):_('inactive')),' ',
					_('device: %s, ingress: %s, egress: %s').format(e.ifname||'-',e.ingress?_('yes'):_('no'),e.egress?_('yes'):_('no'))]));
			}
		});
		rows.push(kvRow(E('code',{},'/etc/init.d/qosify'),n.init));
		return kvTable(rows,'qos-svc-tbl');
	},

	// Rows follow the configured interfaces, so the table is swapped whole; it
	// holds no input or focus.
	updateSvcTable:function(ctx){
		var t=$('qos-svc-tbl');
		if(t)t.parentNode.replaceChild(this.renderSvcTable(ctx),t);
		this.svcButtons(ctx);
	},

	// The label is the state, so with the state unknown there is nothing to toggle.
	// The click reads _auto, so a tick that changes the state changes the action.
	autoButton:function(ctx,el){
		this._auto=ctx.enabled;
		el.disabled=this.readonly||ctx.enabled==null;
		if(ctx.enabled==null){
			el.className='cbi-button';
			el.title=_('Autostart state unknown — rpcd did not answer');
			dom.content(el,_('Unknown'));
			return;
		}
		el.className='cbi-button '+(ctx.enabled?'cbi-button-positive':'cbi-button-negative');
		el.title=ctx.enabled?_('Click to disable autostart'):_('Click to enable autostart');
		dom.content(el,ctx.enabled?_('Enabled'):_('Disabled'));
	},

	renderCfgFiles:function(ctx){
		var rulesN=(ctx.rulesN!=null)?ctx.rulesN:countRules(ctx.rulesText);
		var cfgOk=(ctx.cfgOk!=null)?ctx.cfgOk:((ctx.cfgRaw||'').length>10&&/(^|\n)config /.test(ctx.cfgRaw||''));
		var secN=uci.sections('qosify').length;
		function row(path,st,ok,n){
			return [E('code',{},path),st?(ok?badge('success',_('Valid')):badge('warning',_('Found (empty or invalid)'))):badge('danger',_('Missing')),
				st?n:'-',st?fmtSize(st.size):'-',st?fmtMtime(st.mtime):'-'];
		}
		return gridTable([_('File'),_('Status'),_('Entries'),_('Size'),_('Modified')],[
			row(UCI_PATH,ctx.cfgStat,cfgOk,N_(secN,'%d section','%d sections').format(secN)),
			row(RULES_PATH,ctx.rulesStat,rulesN>0,N_(rulesN,'%d rule','%d rules').format(rulesN))
		]);
	},

	tabConfig:function(ctx){
		var self=this;
		var section=E('div',{'id':'qos-cf'});
		var fs1=sect(_('Config'),[sdesc([_('UCI configuration — classes, interfaces, defaults.')+' ',E('code',{},UCI_PATH)])]);

		// Quick Add Config — built first so the reference table can be derived from it
		var classes=this.getClasses();
		var dscpChoices=classes.map(function(c){return c.name;}).concat(DSCP);
		var qa=E('div',{'class':'qos-qa'});
		qa.appendChild(E('h4',{},_('Quick Add Config')));
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
		var ref=E('details',{});
		ref.appendChild(E('summary',{},_('Config Reference')));
		ref.appendChild(this.refTable({defaults:qadDef,'class':qadCls,'interface':qadIf}));
		var defBox=E('p',{'id':'qos-cfg-def'});
		dom.content(defBox,this.defsNodes());
		ref.appendChild(defBox);
		ref.appendChild(kvTable(classes.map(function(c){return self.clsBoxNode(c);}),'qos-cfg-cls'));
		ref.appendChild(E('p',{},
			_('DSCP codepoints: CS0–CS7, AF11–AF43, EF, VA, NQB, LE, DF. Any dscp_* value may also name a class. Prefix with + to override only when the DSCP field is zero.')));
		ref.appendChild(E('p',{},
			_('Defaults qosify applies when a key is absent — interface: mode diffserv4, ingress 1, egress 1, nat 1, host_isolate 1, autorate_ingress 0. device: identical except nat 0. defaults: timeout 3600, dscp_default_tcp/udp CS0, dscp_prio/dscp_bulk/dscp_icmp unset, bulk_trigger_pps/bulk_trigger_timeout/prio_max_avg_pkt_len 0 (disabled).')));
		fs1.appendChild(ref);
		fs1.appendChild(qa);

		// Editor
		var ta=E('textarea',{'id':'qos-config-ta','rows':28},ctx.cfgRaw||'');
		ta.dataset.orig=ctx.cfgRaw||'';
		stampFile(ta,ctx.cfgStat);
		fs1.appendChild(ta);
		fs1.appendChild(E('div',{'class':'cbi-page-actions'},[
			E('button',{'class':'cbi-button cbi-button-reset','click':function(){return self.clearCfg();}},_('Clear')),' ',
			E('button',{'class':'cbi-button cbi-button-apply','click':function(){return self.saveConfig();}},_('Save & Apply'))
		]));

		section.appendChild(fs1);
		return section;
	},

	clsBoxNode:function(c){return kvRow(E('strong',{},clsLabel(c)),clsDesc(c));},

	refTable:function(panels){
		var note={
			'class':_('Section name is the class name that rules and dscp_* values refer to. value sets ingress and egress together.'),
			alias:_('Same options as class — gives an existing class a second name.'),
			'interface':_('name is the netifd interface. bandwidth applies only where bandwidth_up/bandwidth_down are unset. overhead and overhead_encap apply only when overhead_type is manual.'),
			device:_('Same options as interface, but name is a netdev. nat defaults to 0 here and to 1 for interfaces.')
		};
		return kvTable(SECT.map(function(o){
			var div=panels[QAC_PANEL[o[0]]],els=div?div.querySelectorAll('[data-opt]'):[],out=[];
			for(var i=0;i<els.length;i++)
				out.push((els[i].getAttribute('data-pre')==='list'?'list ':'option ')+els[i].getAttribute('data-opt'));
			return kvRow(E('code',{},o[1]),[E('code',{},out.join(', ')),note[o[0]]?desc(note[o[0]]):'']);
		}));
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
		if(!d)return [E('em',{},_('No config defaults section defined'))];
		var keys=['timeout','dscp_default_tcp','dscp_default_udp','dscp_icmp','dscp_prio','dscp_bulk','prio_max_avg_pkt_len','bulk_trigger_pps','bulk_trigger_timeout'];
		var line=[E('strong',{},'config defaults')];
		keys.forEach(function(k){
			if(d[k])line.push(' ',E('code',{},k+': '+d[k]));
		});
		return line;
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
		var self=this,ref=$('qos-cls-ref');
		if(ref)dom.content(ref,classes.length?classes.map(function(c){return self.clsBoxNode(c);}):noClassRow());
		var cbox=$('qos-cfg-cls');
		if(cbox)dom.content(cbox,classes.map(function(c){return self.clsBoxNode(c);}));
	},

	tabRules:function(ctx){
		var self=this;
		var section=E('div',{'id':'qos-ru'});
		var fs1=sect(_('Classification Rules'),[sdesc([_('DSCP mapping rules loaded by qosify on startup.')+' ',E('code',{},RULES_PATH)])]);

		// Available classes
		var classes=this.getClasses();
		var ref=E('details',{});
		ref.appendChild(E('summary',{},_('Available Classes')));
		ref.appendChild(kvTable(classes.length?classes.map(function(c){return self.clsBoxNode(c);}):[noClassRow()],'qos-cls-ref'));
		ref.appendChild(E('p',{},
			_('Prefix with + to override only when the DSCP field is zero. Ports: tcp:443, udp:3074, ranges: tcp:5060-5061 (1-65534). DNS: dns:*teams*, regex: dns:/zoom[0-9]+, CNAME-only: dns_c:. IP: 1.1.1.1, ff01::1')));
		fs1.appendChild(ref);

		// Quick Add Rule
		var qa=E('div',{'class':'qos-qa'});
		qa.appendChild(E('h4',{},_('Quick Add Rule')));
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
		qarRow.appendChild(E('label',{'for':'qar-prio'},
			[E('input',{'type':'checkbox','id':'qar-prio'}),' '+_('only if unset (+)')]));
		qarRow.appendChild(E('button',{'class':'cbi-button cbi-button-add','click':function(){return self.qarAdd();}},_('Add')));
		qa.appendChild(qarRow);
		fs1.appendChild(qa);

		// Editor
		var ta=E('textarea',{'id':'qos-rules-ta','rows':28},ctx.rulesText||'');
		ta.dataset.orig=ctx.rulesText||'';
		stampFile(ta,ctx.rulesStat);
		fs1.appendChild(ta);
		fs1.appendChild(E('div',{'class':'cbi-page-actions'},[
			E('button',{'class':'cbi-button cbi-button-reset','click':function(){return self.clearRules();}},_('Clear')),' ',
			E('button',{'class':'cbi-button cbi-button-apply','click':function(){return self.saveRules();}},_('Save & Apply'))
		]));

		section.appendChild(fs1);
		return section;
	},

	tabAdvanced:function(ctx){
		var self=this;
		var section=E('div',{'id':'qos-ad'});

		// Backup
		var fb=sect(_('Backup Current Files'),[sdesc(_('Download current config files before making changes.'))]);
		fb.appendChild(this.dlRow('/etc/config/qosify','qosify'));
		fb.appendChild(this.dlRow('/etc/qosify/00-defaults.conf','00-defaults.conf'));
		section.appendChild(fb);

		// Upload
		var fu=sect(_('Upload Config Files'),[sdesc(_('Select files and click Save & Apply to overwrite and restart qosify.'))]);
		var u1=E('input',{'type':'file','id':'qos-up-cfg'});
		var u2=E('input',{'type':'file','id':'qos-up-rules'});
		fu.appendChild(valRow('/etc/config/qosify',u1));
		fu.appendChild(valRow('/etc/qosify/00-defaults.conf',u2));
		fu.appendChild(E('div',{'class':'cbi-page-actions'},
			E('button',{'class':'cbi-button cbi-button-apply','click':function(){return self.uploadFiles();}},_('Save & Apply'))
		));
		section.appendChild(fu);

		section.appendChild(sect(_('Check Devices'),[
			sdesc(_('Re-runs the daemon\'s own device pass: a section whose device now exists is started and one whose device has gone is stopped. The call reports nothing back; the result shows in the Overview tab.')),
			E('div',{'class':'cbi-page-actions'},
				E('button',{'class':'cbi-button cbi-button-action','click':function(){return self.checkDevices();}},_('Check Devices')))
		]));

		// Reset
		section.appendChild(sect(_('Reset to qosify Defaults'),[
			sdesc(_('Replaces both config files with qosify defaults, qosify will be disabled.')),
			E('div',{'class':'cbi-page-actions'},
				E('button',{'class':'cbi-button cbi-button-negative','click':function(){return self.resetDefaults();}},_('Reset to Defaults')))
		]));
		return section;
	},

	dlRow:function(path,fn){
		return valRow(path,
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
				}},_('Download')));
	},

	tabStatus:function(ctx){
		var section=E('div',{'id':'qos-st'});
		var fs1=sect(_('qosify-status'));
		var body=E('div',{'id':'qos-st-body'},[
			E('pre',{'id':'qos-st-pre','style':'display:none'}),
			E('div',{'id':'qos-st-msg'})
		]);
		this.fillStatus(body,ctx);
		fs1.appendChild(body);
		section.appendChild(fs1);
		return section;
	},

	// ubus call qosify get_stats. Master adds ebpf_map_entries, last_reload_time,
	// dns_cache and classes/dscp/dns tables; 24.10 (1501e09) returns
	// qosify_map_stats() at the top level, one table per class, packets only.
	// Only what the reply contains is rendered.
	isCounter:function(v){return !!v&&typeof v==='object'&&(v.packets!=null||v.bytes!=null);},
	// qosify_map_get_ebpf_entry_count() sums the IPv4 and IPv6 address maps only.
	// 1501e09 sends none of these, so there the section stays hidden.
	infoNodes:function(st){
		var rows=[];
		if(st.ebpf_map_entries!=null)rows.push(['ebpf_map_entries',String(st.ebpf_map_entries)]);
		if(st.last_reload_time)rows.push(['last_reload_time',fmtMtime(st.last_reload_time)]);
		if(st.dns_cache)rows.push(['dns_cache','size %d, hits %d, misses %d'.format(st.dns_cache.size||0,st.dns_cache.hits||0,st.dns_cache.misses||0)]);
		if(!rows.length)return null;
		return E('div',{'class':'qbox'},E('table',{'class':'table'},rows.map(function(r){return kvRow(E('code',{},r[0]),r[1]);})));
	},

	// dump lists port, address and DNS entries, but pattern_stats is the only
	// per-entry counter the datapath keeps, so only DNS patterns are listed; the
	// rest is class totals. A raw DSCP as a number, -1 for anything
	// __qosify_map_dscp_value() would reject (strtoul base 0, below 64).
	dscpVal:function(v){
		var s=String(v==null?'':v).replace(/^\+/,'').toUpperCase(),n;
		if(DSCP_VAL[s]!=null)return DSCP_VAL[s];
		n=dscpNum(s);
		return n===null||n>=64?-1:n;
	},
	// What each class marks with; ingress and egress already fall back to value.
	dscpMarks:function(){
		var m={};
		this.getClasses().forEach(function(c){
			m[c.name]=(c.ingress===c.egress)?c.ingress:c.ingress+'/'+c.egress;
		});
		return m;
	},
	dscpRanks:function(){
		var m={},self=this;
		this.getClasses().forEach(function(c){m[c.name]=dscpRank(self.dscpVal(c.egress||c.ingress));});
		return m;
	},
	// DNS rows ordered by dscpRank(). Entries added over ubus (user, no file) carry
	// a timeout and follow the file entries, so the MAP_ROWS cut falls on them.
	mapRows:function(entries){
		var rows=[],dyn=[],cls=this.dscpRanks(),self=this,i,e,a,rk;
		for(i=0;i<entries.length;i++){
			e=entries[i]||{};
			if(e.type!=='dns')continue;
			a=(e.user&&!e.file)?dyn:rows;
			rk=String(e.dscp==null?'':e.dscp).replace(/^\+/,'');
			a.push({type:e.type,addr:e.addr,dscp:e.dscp,file:!!e.file,user:!!e.user,
				timeout:e.timeout,ix:a.length,
				rk:cls[rk]!=null?cls[rk]:dscpRank(self.dscpVal(rk))});
		}
		function byDscp(x,y){return y.rk-x.rk||x.ix-y.ix;}
		return rows.sort(byDscp).concat(dyn.sort(byDscp));
	},
	// dns is the get_stats dns table keyed by pattern; a pattern with no traffic is
	// omitted from it, so it is zero once the table exists.
	// hits counts every matching lookup, packets the pattern_id in the address map
	// entry, which __qosify_map_set_entry() only writes when the DSCP changes.
	// The signature covers the listing's shape only, not the map entry total:
	// qosify adds and expires address entries for DNS results all the time, and
	// with the total in it the table was rebuilt on nearly every tick. While it
	// holds, the traffic and timeout cells and the footer are set in place.
	mapSig:function(rows){
		var out=String(rows.length),i,r;
		for(i=0;i<rows.length&&i<MAP_ROWS;i++){
			r=rows[i];
			out+='\n'+[r.addr,r.dscp,r.file,r.user,r.timeout!=null].join(',');
		}
		return out;
	},

	// qosify_map_dump() emits timeout for user entries only; no column without one.
	// Header and rows are two fixed-layout tables sharing column widths: the
	// header sits above the scroll box, so nothing scrolls under it, and is
	// padded by the scrollbar width so the columns line up.
	mapNodes:function(rows){
		var cells=this._mapCells=[],wcol=rows.some(function(r){return r.timeout!=null;}),
			cols=[['dns',34],['dscp',14],['file / user',12],['hits / packets / bytes',28,1]];
		if(wcol)cols.push(['timeout',12,1]);
		var trs=rows.slice(0,MAP_ROWS).map(function(r){
			var src=[],a=String(r.addr!=null?r.addr:'-'),c={t:E('td',{'class':'td qn'}),w:wcol?E('td',{'class':'td qn'}):null};
			if(r.file)src.push('file');
			if(r.user)src.push('user');
			cells.push(c);
			return E('tr',{'class':'tr'},[E('td',{'class':'td','title':a},E('code',{},a)),
				E('td',{'class':'td'},r.dscp||'-'),E('td',{'class':'td'},src.join(', ')||'-'),c.t,c.w||'']);
		});
		return E('div',{'class':'qbox'},[colHead(cols,'qos-cn-map-head'),E('div',{'id':'qos-cn-map-box'},colTable(cols,trs))]);
	},

	mapValues:function(rows,dns){
		var lg=$('qos-cn-map-sect-title'),t;
		(this._mapCells||[]).forEach(function(c,i){
			var r=rows[i],e=(dns&&dns[r.addr])||{},t,w;
			t=!dns?'-':[Number(e.hits||0).toLocaleString(),Number(e.packets||0).toLocaleString()].concat(e.bytes==null?[]:['%1024.2mB'.format(e.bytes)]).join(' / ');
			w=r.timeout!=null?'%t'.format(r.timeout):'-';
			if(c.t.textContent!==t)c.t.textContent=t;
			if(c.w&&c.w.textContent!==w)c.w.textContent=w;
		});
		t=rows.length>MAP_ROWS?_('DNS Entries (%d of %d)').format(MAP_ROWS,rows.length):_('DNS Entries (%d)').format(rows.length);
		if(lg&&lg.textContent!==t)lg.textContent=t;
		var mb=$('qos-cn-map-box'),mh=$('qos-cn-map-head');
		if(mb&&mh)mh.style.paddingRight=Math.max(0,mb.offsetWidth-mb.clientWidth)+'px';
	},

	// One service list and one get_stats, then dump alongside qosify-status: the
	// map listing's traffic column reads the stats just fetched, so both are
	// chained after them, and qosify-status is only forked while qosify runs.
	// Master always opens the dns table, so its absence identifies the build
	// rather than a quiet period: 25.12 and 24.10 (1501e09) have none, so dump is
	// not called and DNS Entries stays hidden, and it shows by itself on any build
	// that gains the table. fillMap() skips the rebuild while its signature is
	// unchanged, so the one-entry-per-port dump costs a compare, not a redraw.
	refreshCounters:function(){
		var self=this;
		if(self.currentTab!=='cn')return Promise.resolve();
		return Promise.all([
			callServiceList('qosify').catch(function(){return null;}),
			callQosifyStats().catch(function(){return null;})
		]).then(function(d){
			var ctx={running:d[0]?isRunning(d[0]):null,stats:d[1]};
			self._cnStats=ctx.running?ctx.stats:null;
			if(ctx.stats)self._cnDns=ctx.stats.dns!=null;
			self.fillCounters(ctx);
			return Promise.all([self._cnDns?callQosifyDump().catch(function(){return null;}):null,ctx.running,
				ctx.running&&!self.readonly?L.resolveDefault(fs.exec('/usr/sbin/qosify-status',[]),null):null]);
		}).then(function(r){
			self.fillTins(r[1],r[2]);
			self.fillMap(r[0],self._cnStats&&self._cnStats.dns);
		});
	},

	tabCounters:function(){
		return E('div',{'id':'qos-cn'},[
			sect(_('Traffic by Class'),[E('div',{'id':'qos-cn-msg'}),E('div',{'id':'qos-cn-bars'})]),
			sect(_('Traffic by CAKE Tin'),E('div',{'id':'qos-cn-tins'},emP(_('Loading...'))),{'id':'qos-cn-tin-sect','style':'display:none'}),
			sect('get_stats',E('div',{'id':'qos-cn-info'}),{'id':'qos-cn-info-sect','style':'display:none'}),
			sect(_('DNS Entries'),E('div',{'id':'qos-cn-map'},emP(_('Loading...'))),{'id':'qos-cn-map-sect','style':'display:none'})
		]);
	},

	// Cumulative totals since the last reload, EF first and bulk last. A
	// dscp_default_* naming a class is counted against that class, so the two
	// default slots would double-count and are skipped.
	// Grouped and coloured by the tin the class's egress codepoint lands in under
	// mode, highest priority tin first as the tin bars are, then by codepoint within
	// a tin. With no single mode to fold by, codepoint order and a colour per name.
	classTotals:function(st,mode){
		var cls=st&&st.classes,k,rows=[],names=[],total=0,bytes=null,self=this,
			fold=MODES.indexOf(mode)>=0,rank=this.dscpRanks(),mark=this.dscpMarks(),tin={};
		if(fold)this.getClasses().forEach(function(c){
			var v=self.dscpVal(c.egress||c.ingress);
			tin[c.name]=v<0?-1:+TIN_MAP[mode].charAt(v);
		});
		if(!cls){
			cls={};
			for(k in st)if(self.isCounter(st[k]))cls[k]=st[k];
		}
		for(k in cls)if(cls[k].packets!=null&&!CN_SKIP[k])names.push(k);
		names.sort();
		names.forEach(function(n,ix){
			var v=cls[n].packets||0;
			total+=v;
			if(cls[n].bytes!=null)bytes=(bytes||0)+cls[n].bytes;
			var t=tin[n]!=null?tin[n]:-1;
			rows.push({name:n,v:v,bytes:cls[n].bytes,tin:t,
				color:!fold?CN_COLORS[ix%CN_COLORS.length]:t<0?CN_NONE:TIN_COLORS[mode][t],
				mark:mark[n]||'',rk:rank[n]!=null?rank[n]:-1000});
		});
		rows.sort(function(a,b){return b.tin-a.tin||b.rk-a.rk||(a.name<b.name?-1:1);});
		rows.total=total;
		rows.bytes=bytes;
		return rows;
	},

	// The CAKE mode behind each shaped direction. cmd_add_qdisc() writes mode, then
	// options, then the direction's options, and tc keeps the last mode keyword.
	// cmd_add_ingress() attaches the classifier before it checks ingress, so an
	// unshaped ingress is still counted.
	cakeModes:function(){
		var r=[];
		['interface','device'].forEach(function(t){
			uci.sections('qosify',t,function(s){
				if(uciBool(s.disabled,false)||!s.name)return;
				var c=ifCfg(s,t==='device');
				[[c.egress,s.egress_options],[c.ingress,s.ingress_options]].forEach(function(d){
					if(!d[0])return;
					var mode=c.mode;
					(String(s.options||'')+' '+String(d[1]||'')).split(/\s+/).forEach(function(w){if(MODES.indexOf(w)>=0)mode=w;});
					if(r.indexOf(mode)<0)r.push(mode);
				});
			});
		});
		return r;
	},

	// qosify-status, as the Status tab prints it: tc -s qdisc for each shaped
	// direction. q_cake.c prints a column per tin in tin_order, lowest priority
	// first, so a column is a TIN_COLORS index; rows are reversed to put the
	// highest priority tin first, as the class bars are. Qdiscs running the same
	// mode are summed tin by tin into one chart, egress and ingress together; a
	// mode only one direction runs gets a chart of its own.
	cakeTins:function(txt){
		var blk=[],grp=[],key={},b=null;
		String(txt||'').split('\n').forEach(function(l){
			var m,w;
			if(/^===== (?:interface|device) \S+: /.test(l)||/^(egress|ingress) status:$/.test(l))b=null;
			else if(/^qdisc /.test(l)){
				w=l.split(/\s+/).filter(function(x){return MODES.indexOf(x)>=0;});
				b=/^qdisc cake /.test(l)?{mode:w.pop()}:null;
				if(b)blk.push(b);
			}
			else if(b&&!b.names&&/^\s+(Bulk|Tin 0)\b/.test(l))b.names=l.trim().split(/\s{2,}/);
			else if(b&&b.names&&(m=l.match(/^  (pkts|bytes|drops|marks)\s+(.*)$/)))
				b[m[1]]=m[2].trim().split(/\s+/).map(Number);
		});
		blk.forEach(function(b){
			if(!b.names||!b.pkts)return;
			var k=b.mode+'|'+b.names.join('|'),g=key[k];
			if(!g)grp.push(g=key[k]={mode:b.mode,names:b.names,pkts:[],bytes:[],drops:[],marks:[]});
			['pkts','bytes','drops','marks'].forEach(function(f){
				if(!b[f])g[f]=null;
				else if(g[f])b[f].forEach(function(v,i){g[f][i]=(g[f][i]||0)+v;});
			});
		});
		return grp.map(function(g){
			var c=TIN_COLORS[g.mode],n=g.names.length,rows=g.names.map(function(t,i){
				var r={name:t,v:g.pkts[i]||0,bytes:g.bytes?g.bytes[i]||0:null,
					drops:g.drops?g.drops[i]||0:null,marks:g.marks?g.marks[i]||0:null,
					color:c&&c.length===n?c[i]:CN_COLORS[i%CN_COLORS.length]};
				return r;
			}).reverse();
			rows.total=rows.reduce(function(t,r){return t+r.v;},0);
			rows.bytes=g.bytes?rows.reduce(function(t,r){return t+r.bytes;},0):null;
			return rows;
		});
	},

	// A compact box, header table above the rows as on DNS Entries: name, codepoint where a row has one, a
	// .cbi-progressbar, then the counters under the names their source uses
	// (get_stats packets/bytes, tc pkts/bytes/drops) and share, with a total row.
	// Built again only when the rows or columns change; otherwise cells and bar
	// widths are set in place. Length is (row/largest row)^BAR_EXP, a non-zero
	// row kept at 1%.
	drawChart:function(box,rows,empty,head){
		var total=rows.total||0,max=0,c=box.qosChart,sig,
			dcol=rows.some(function(r){return r.mark;}),
			bcol=rows.bytes!=null,
			xcol=rows.some(function(r){return r.drops!=null;}),
			pk=xcol?'pkts':'packets';
		if(!rows.length){box.qosChart=null;dom.content(box,emP(empty));return;}
		rows.forEach(function(r){if(r.v>max)max=r.v;});
		sig=[dcol,bcol,xcol].concat(rows.map(function(r){return r.name;})).join('\n');
		function td(n,t){return E('td',{'class':n?'td qn':'td left','data-title':t});}
		function set(el,v){if(el&&el.textContent!==v)el.textContent=v;}
		function num(n){return Number(n||0).toLocaleString();}
		if(!c||c.sig!==sig){
			var cols=[[head,20]];
			if(dcol)cols.push(['dscp',10]);
			cols.push(['',34],[pk,13,1]);
			if(bcol)cols.push(['bytes',13,1]);
			if(xcol)cols.push(['drops',9,1]);
			cols.push([_('share'),9,1]);
			c=box.qosChart={sig:sig,rows:[]};
			var trs=rows.map(function(){
				var o={name:td(0,head),dscp:dcol?td(0,'dscp'):null,fill:E('div'),pkt:td(1,pk),
					bytes:bcol?td(1,'bytes'):null,drops:xcol?td(1,'drops'):null,share:td(1,_('share'))};
				o.tr=E('tr',{'class':'tr'},[o.name,o.dscp||'',
					E('td',{'class':'td'},E('div',{'class':'cbi-progressbar'},o.fill)),
					o.pkt,o.bytes||'',o.drops||'',o.share]);
				c.rows.push(o);
				return o.tr;
			});
			c.tot={pkt:td(1,pk),bytes:bcol?td(1,'bytes'):null,drops:xcol?td(1,'drops'):null};
			trs.push(E('tr',{'class':'tr qt'},[E('td',{'class':'td left'},_('total')),dcol?E('td',{'class':'td'}):'',E('td',{'class':'td'}),
				c.tot.pkt,c.tot.bytes||'',c.tot.drops||'',E('td',{'class':'td qn'},_('%s%%').format(100))]));
			dom.content(box,E('div',{'class':'qbox'},[colHead(cols),colTable(cols,trs)]));
		}
		rows.forEach(function(r,i){
			var o=c.rows[i],share=total?(r.v/total)*100:0,
				len=max&&r.v?Math.max(Math.pow(r.v/max,BAR_EXP)*100,1):0,
				tip=r.marks!=null?'marks %d'.format(r.marks):'';
			set(o.name,r.name);
			if(o.name.title!==r.name)o.name.title=r.name;
			set(o.dscp,r.mark||'');
			set(o.pkt,num(r.v));
			if(o.bytes)set(o.bytes,'%1024.2mB'.format(r.bytes||0));
			if(o.drops)set(o.drops,r.drops!=null?num(r.drops):'-');
			set(o.share,fmtShare(share));
			if(o.tr.title!==tip)o.tr.title=tip;
			o.fill.style.width=len.toFixed(2)+'%';
			o.fill.style.background=r.color;
		});
		set(c.tot.pkt,num(total));
		if(c.tot.bytes)set(c.tot.bytes,'%1024.2mB'.format(rows.bytes));
		if(c.tot.drops)set(c.tot.drops,num(rows.reduce(function(t,r){return t+(r.drops||0);},0)));
	},

	drawBars:function(){
		var st=this._cnStats,box=$('qos-cn-bars'),m=this.cakeModes();
		if(!box)return;
		if(st)this.drawChart(box,this.classTotals(st,m.length===1?m[0]:null),_('No per-class counters.'),'class');
		else{box.qosChart=null;dom.content(box,'');}
	},

	// CAKE's own per-tin counters, per qdisc since it was created, so they need
	// not add up to the class totals, which count what the classifier matched.
	// A fork that fails keeps the last charts rather than collapsing the section.
	fillTins:function(running,r){
		var sect=$('qos-cn-tin-sect'),box=$('qos-cn-tins'),self=this,t;
		if(!sect||!box)return;
		sect.style.display=running?'':'none';
		if(!running)return;
		if(!this.readonly&&!r&&this._tinOk)return;
		t=this.readonly?[]:this.cakeTins(r&&r.stdout);
		this._tinOk=t.length>0;
		if(!t.length){
			box.qosGroups=0;
			dom.content(box,emP(this.readonly?_('Requires write access.'):r&&r.stdout?_('No CAKE tin statistics.'):_('No output.')));
			return;
		}
		if(box.qosGroups!==t.length){
			box.qosGroups=t.length;
			dom.content(box,t.map(function(){return E('div');}));
		}
		t.forEach(function(rows,i){self.drawChart(box.childNodes[i],rows,'','tin');});
	},

	// Nothing here survives the daemon: get_stats counts since the last reload and
	// the tin figures come from qdiscs a stop removes. So a stopped qosify clears
	// the charts and drops every box but the notice, as the Status tab does, rather
	// than leaving the last poll's numbers on screen looking live. _cnDns is reset
	// with it, or DNS Entries would keep a stale listing until stats return.
	fillCounters:function(ctx){
		var msg=$('qos-cn-msg'),info=$('qos-cn-info'),is=$('qos-cn-info-sect'),
			nodes=ctx.running&&ctx.stats?this.infoNodes(ctx.stats):null;
		if(is)is.style.display=nodes?'':'none';
		if(!ctx.running){
			this._cnDns=false;
			if(info)dom.content(info,'');
			this.drawBars();
			if(msg)dom.content(msg,E('div',{'class':'alert-message warning'},ctx.running==null?
				_('rpcd is not answering for qosify, so the service state is unknown.'):
				_('qosify is not running. Start from the Overview tab.')));
			return;
		}
		if(msg)dom.content(msg,ctx.stats?'':emP(_('get_stats did not answer.')));
		this.drawBars();
		if(info)dom.content(info,nodes||'');
	},

	// Rebuilt only when the listing's shape changes; otherwise only the figures
	// and footer are rewritten.
	fillMap:function(r,dns){
		var box=$('qos-cn-map'),lg=$('qos-cn-map-sect-title'),sc=$('qos-cn-map-sect');
		if(sc)sc.style.display=this._cnDns?'':'none';
		if(!box||!this._cnDns)return;
		var e=(r&&r.entries)||[],rows=this.mapRows(e),sig,t;
		if(!rows.length){
			this._mapSig=this._mapCells=null;
			if(lg)lg.textContent=_('DNS Entries');
			t=_('No DNS entries.');
			if(box.textContent!==t)dom.content(box,emP(t));
			return;
		}
		sig=this.mapSig(rows);
		if(sig!==this._mapSig){
			t=$('qos-cn-map-box');
			t=t?t.scrollTop:0;
			this._mapSig=sig;
			dom.content(box,this.mapNodes(rows));
			$('qos-cn-map-box').scrollTop=t;
		}
		this.mapValues(rows,dns);
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
		var pre=body.querySelector('#qos-st-pre'),msg=body.querySelector('#qos-st-msg');
		if(!pre||!msg)return;
		var note=function(t){dom.content(msg,emP(t));};
		if(!ctx.running){
			pre.style.display='none';
			dom.content(msg,E('div',{'class':'alert-message warning'},ctx.running==null?
				_('rpcd is not answering for qosify, so the service state is unknown.'):
				_('qosify is not running. Start from the Overview tab.')));
			return;
		}
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

	// === Actions ===

	mapReload:function(){
		var self=this;
		self.lock();
		ui.showModal(_('Working'),[E('p',{},_('Re-reading the mapping files...'))]);
		return callQosifyReload().then(function(){
			notify(_('Mapping files reloaded.'),'info');
			return self.refreshOverview();
		}).catch(function(e){
			notify(_('Reload failed: %s').format(e),'danger');
		}).finally(function(){
			ui.hideModal();
			self.unlock();
		});
	},

	// check_devices arms a 10 ms uloop timer and returns before the pass runs, so
	// wait for it before reading the state back.
	checkDevices:function(){
		var self=this;
		self.lock();
		ui.showModal(_('Working'),[E('p',{},_('Re-checking devices...'))]);
		return callQosifyCheckDevices().then(function(){
			return new Promise(function(r){setTimeout(r,800);});
		}).then(function(){
			notify(_('Device check done.'),'info');
			return self.refreshOverview();
		}).catch(function(e){
			notify(_('Device check failed: %s').format(e),'danger');
		}).finally(function(){
			ui.hideModal();
			self.unlock();
		});
	},

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

	// true shaping, false not shaping, null the status call did not answer. The
	// qosify object goes with the daemon, so an unanswered call is only unknown
	// while qosify runs; a stopped qosify is plainly not shaping. A retry costs one
	// ubus call, so an unanswered one is retried like an idle reply.
	waitForShaping:function(tries){
		var self=this;
		return callQosifyStatus().catch(function(){
			return callServiceList('qosify').then(function(r){return isRunning(r)?null:{};},function(){return null;});
		}).then(function(st){
			var a=st?statusActive(st):null;
			if(a||tries<=1)return a;
			return new Promise(function(res){setTimeout(res,700);}).then(function(){return self.waitForShaping(tries-1);});
		});
	},

	checkShapingForSave:function(prefix){
		var sn=ifSect(),w=(sn&&uci.get('qosify',sn.id))||{};
		if(uciBool(w.disabled,false))return Promise.resolve({text:_('%s, applied (QoS disabled).').format(prefix),kind:'info'});
		return this.waitForShaping(3).then(function(active){
			if(active)return {text:_('%s, applied.').format(prefix),kind:'info'};
			// An unanswered status call is not a report of idle qdiscs: saying "not
			// shaping" there turns a stale ACL into a false negative on a box that is.
			if(active==null)return {text:_('%s, applied — qosify did not answer on ubus, so shaping could not be checked.').format(prefix),kind:'warning'};
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

	// rc and service answer whenever rpcd does and the session's ACL still covers
	// this app, so either of them failing is the single condition behind every
	// unknown here -- rpcd is not answering for qosify -- and running/enabled/
	// hasInit go null instead of false, which would read as a stopped, unshaped,
	// uninstalled qosify on a box that is shaping fine.
	gatherCtx:function(withFiles){
		var self=this;
		function nul(){return null;}
		return Promise.all([
			callServiceList('qosify').catch(nul),
			callRcList('qosify',true).catch(nul),
			callQosifyStatus().catch(nul),
			L.resolveDefault(fs.stat(UCI_PATH),null),
			L.resolveDefault(fs.stat(RULES_PATH),null),
			withFiles?fs.read(UCI_PATH).catch(nul):null,
			withFiles?fs.read(RULES_PATH).catch(nul):null
		]).then(function(d){
			var rpcOk=d[0]!==null&&d[1]!==null,rc=d[1]&&d[1].qosify;
			var running=rpcOk?isRunning(d[0]):null;
			// The qosify object goes with the daemon, so a stopped qosify explains an
			// unanswered status call by itself: shaping only reads unknown while it runs.
			var st=d[2]||(running===false?{}:null);
			var ctx={
				rpcOk:rpcOk,
				running:running,
				enabled:rpcOk?!!(rc&&rc.enabled):null,
				hasInit:rpcOk?!!rc:null,
				status:st,
				active:st?statusActive(st):null,
				shaped:st?statusCount(st):null,
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
			return self.uptime(d[0]).then(function(u){ctx.uptime=u;return ctx;});
		});
	},

	// Seconds since the running qosify started, or null. procd's service list
	// carries the pid but no start time, so starttime (field 22 of /proc/<pid>/stat,
	// USER_HZ ticks since boot) is set against /proc/uptime: both run on the boot
	// clock, so an NTP step does not skew it. A reload keeps the pid; the start is
	// cached per pid, so ticks read nothing until qosify is restarted.
	uptime:function(r){
		var self=this,pid=runPid(r);
		if(!pid){self._up=null;return Promise.resolve(null);}
		if(self._up&&self._up.pid===pid)return Promise.resolve(Date.now()/1000-self._up.t);
		return Promise.all([fs.read('/proc/'+pid+'/stat'),fs.read('/proc/uptime')]).then(function(d){
			var st=String(d[0]),f=st.slice(st.lastIndexOf(')')+2).split(' '),up=parseFloat(d[1])-f[19]/100;
			if(!(up>=0))return null;
			self._up={pid:pid,t:Date.now()/1000-up};
			return up;
		}).catch(function(){return null;});
	},

	// Poll path: six ubus calls (uci.get and gatherCtx(false)'s five), no shell
	// forks, and the parts of the page that hold user input or focus are patched
	// in place rather than rebuilt.
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
			self.fillSect('qos-qs-sect',self.buildQsSect(ctx));
			return ctx;
		});
	},

	refreshStatus:function(){
		var self=this;
		if(self.currentTab!=='st'||self._st)return Promise.resolve();
		self._st=true;
		var ex=self.readonly?Promise.resolve(null):L.resolveDefault(fs.exec('/usr/sbin/qosify-status',[]),null);
		return callServiceList('qosify').catch(function(){return null;}).then(function(d){
			var ctx={running:d?isRunning(d):null,qstatus:self.readonly?'':null};
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
