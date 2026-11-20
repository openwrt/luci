// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';
'require fs';
'require rpc';
'require uci';

// Status > Overview card: the Service rows of the app's Overview tab, with the
// shaped rates. Three ubus calls a tick and the qosify config, which uci.load()
// reads once per page, so nothing forks. index.js stops drawing a card whose
// load() rejects, so each call settles to null, shown as unknown.
var callServiceList=rpc.declare({object:'service',method:'list',params:['name'],expect:{'':{}},reject:true});
// skip_running_check keeps rc.list from forking `qosify running`.
var callRcList=rpc.declare({object:'rc',method:'list',params:['name','skip_running_check'],expect:{'':{}},reject:true});
var callQosifyStatus=rpc.declare({object:'qosify',method:'status',expect:{'':{}},reject:true});
// Bootstrap and OpenWrt 2020 have no .label.danger; the app's own rule from
// qosify.css. Footstrap drops the row lines of a two-cell table on this page:
// a rule outside its layers draws them, and :where() keeps it under any theme's
// .table .td, so bootstrap and its phone layout keep their own lines.
var STYLE='.qos-ov .label.danger{background-color:var(--error-color-high,#e8210d);color:var(--on-error-color,#fff)}'+
	':where(.qos-ov .tr+.tr)>.td{border-top:1px solid var(--border-color-medium,rgba(128,128,128,.35))}';

function nul(){return null;}
function tx(v){return typeof v==='string'?[v]:v;}
function badge(kind,t){return E('span',{'class':'label '+kind},tx(t));}
function unk(){return badge('warning',_('Unknown'));}
function kvRow(k,v){return E('tr',{'class':'tr'},[E('td',{'class':'td left','width':'33%'},tx(k)),E('td',{'class':'td left'},tx(v))]);}
function isRunning(r){try{var i=r.qosify.instances;for(var k in i)if(i[k].running)return true;}catch(e){}return false;}
function runPid(r){try{var i=r.qosify.instances;for(var k in i)if(i[k].running&&i[k].pid)return i[k].pid;}catch(e){}return 0;}
// The status keys are option name; qosify.init sends no disabled section
// (config_get_bool) and falls back to bandwidth for an unset direction. A
// shaped direction without one runs CAKE unlimited.
function ifSect(type,name){
	return uci.sections('qosify',type).filter(function(s){return s.name===name&&!/^(1|on|true|yes|enabled)$/.test(s.disabled);})[0]||null;
}
function rate(s,on,k){return !on?_('no'):!s?_('yes'):s['bandwidth_'+k]||s.bandwidth||_('unlimited');}

return baseclass.extend({
	title:_('qosify'),

	load:function(){
		var self=this;
		return Promise.all([
			callServiceList('qosify').catch(nul),
			callRcList('qosify',true).catch(nul),
			callQosifyStatus().catch(nul),
			uci.load('qosify').catch(nul)
		]).then(function(d){return self.uptime(d[0]).then(function(u){d.push(u);return d;});});
	},

	// As on the Overview tab: service list carries the pid but no start time, so
	// starttime (field 22 of /proc/<pid>/stat, USER_HZ ticks since boot) is set
	// against /proc/uptime, once per pid; later ticks add performance.now().
	uptime:function(r){
		var self=this,pid=runPid(r);
		if(!pid){self._up=null;return Promise.resolve(null);}
		if(self._up&&self._up.pid===pid)return Promise.resolve(self._up.up+(performance.now()-self._up.t)/1000);
		return Promise.all([fs.read('/proc/'+pid+'/stat'),fs.read('/proc/uptime')]).then(function(d){
			var st=String(d[0]),f=st.slice(st.lastIndexOf(')')+2).split(' '),up=parseFloat(d[1])-f[19]/100;
			if(!(up>=0))return null;
			self._up={pid:pid,up:up,t:performance.now()};
			return up;
		}).catch(nul);
	},

	// The Overview tab's rows and wording, each interface with its rates in place
	// of yes. The qosify object goes with the daemon, so an unanswered status
	// call only reads unknown while it runs.
	render:function(d){
		var run=d[0]!==null?isRunning(d[0]):null,rc=d[1]&&d[1].qosify,st=d[2]||(run===false?{}:null),n=0,ifs=[];
		if(st)['interfaces','devices'].forEach(function(g){
			for(var k in st[g]){
				var e=st[g][k]||{},s=d[3]!==null?ifSect(g==='devices'?'device':'interface',k):null;
				if(e.active)n++;
				ifs.push(kvRow((g==='devices'?_('device %s'):_('interface %s')).format(k),[badge(e.active?'success':'danger',e.active?_('active'):_('inactive')),' ',
					_('device: %s, ingress: %s, egress: %s').format(e.ifname||'-',rate(s,e.ingress,'down'),rate(s,e.egress,'up'))]));
			}
		});
		return E([E('style',{},[STYLE]),E('table',{'class':'table qos-ov'},[
			kvRow(_('Status'),run==null?unk():run&&!st?badge('warning',_('Running — Shaping Unknown')):run&&n?badge('success',_('Running & Shaping')):
				run?badge('warning',_('Running — Not Shaping')):badge('danger',_('Not Running'))),
			kvRow(_('Uptime'),d[4]!=null?'%t'.format(Math.floor(d[4])):'-'),
			kvRow(_('Autostart'),d[1]===null?unk():rc&&rc.enabled?badge('success',_('Enabled')):badge('danger',_('Disabled')))
		].concat(ifs))]);
	}
});
