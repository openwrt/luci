import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';

const translations=JSON.parse(readFileSync(new URL('./translations.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../htdocs/luci-static/resources/menu-athena.js',import.meta.url),'utf8');
function overview(cores=2,reducedMotion=false) {
 const {document,window}=parseHTML(`<html lang="zh-cn"><body><div id="athena-summary" data-cpu-count="${cores}"></div></body></html>`);
 const E=(tag,attrs={},children=[])=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(typeof value==='function')node.addEventListener(key,value);else if(value!=null)node.setAttribute(key,String(value));}for(const item of [children].flat(Infinity))if(item!=null)node.append(typeof item==='object'?item:document.createTextNode(String(item)));return node;};
 const frames=new Map(),observers=[];let nextFrame=0;
 window.matchMedia=()=>({matches:reducedMotion,addEventListener(){}});
 const requestFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame;};
 class Observer {constructor(callback){this.callback=callback;observers.push(this);}observe(){}}
 const api=new Function('document','window','baseclass','widgets','E','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','_',source)(document,window,{extend:value=>value},{icon:()=>document.createElementNS('http://www.w3.org/2000/svg','svg')},E,Observer,requestFrame,id=>frames.delete(id),s=>translations[s]||s);
 api.renderSummary();return {api,document,window,frames,resize:width=>observers[0].callback([{contentRect:{width}}]),step:time=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time);},load:document.querySelector('[data-metric="load"]'),memory:document.querySelector('[data-metric="memory"]'),storage:document.querySelector('[data-metric="storage"]')};
}
test('status dials normalize one-minute load by online CPUs and show available-memory usage',()=>{
 const {api,load,memory}=overview(2);
 api.updateSummary({}, {load:[65536],memory:{total:1000,available:200,free:100},uptime:120},[]);
 assert.equal(load.querySelector('output').textContent,'50%');
 assert.match(load.querySelector('.athena-metric-detail').textContent,/1\.00.*2 核/);
 assert.equal(memory.querySelector('output').textContent,'80%');
 assert.match(memory.getAttribute('aria-label'),/内存使用 80%/);
});
test('internet card contains uptime and update time and preserves them across connection changes',()=>{
 const {api,document}=overview(),card=document.querySelector('[data-metric="internet"]'),uptime=document.querySelector('#athena-uptime'),updated=document.querySelector('#athena-last-update');
 assert.equal(uptime.closest('[data-metric]'),card);assert.equal(updated.closest('[data-metric]'),card);assert.equal(document.querySelector('.athena-summary-meta'),null);
 api.updateSummary({}, {uptime:23*3600+53*60},[{interface:'wan',up:true,'ipv4-address':[{address:'10.0.2.15'}]}]);
 assert.equal(card.dataset.connected,'true');assert.equal(card.querySelector('.athena-metric-value').textContent,'已连接');assert.match(card.querySelector('.athena-metric-detail').textContent,/10\.0\.2\.15/);
 const uptimeValue=uptime.querySelector('.athena-uptime-value');assert.equal(uptime.textContent,'已稳定运行 23 小时 53 分钟');assert.equal(uptimeValue.textContent,'23 小时 53 分钟');assert.match(updated.textContent,/更新于/);
 api.updateSummary({}, {uptime:24*3600},[{interface:'wan',up:false}]);
 assert.equal(card.dataset.connected,'false');assert.equal(card.querySelector('.athena-metric-value').textContent,'未连接');assert.equal(document.querySelector('#athena-uptime'),uptime);assert.equal(uptime.querySelector('.athena-uptime-value'),uptimeValue);assert.equal(uptimeValue.textContent,'24 小时 0 分钟');assert.equal(document.querySelector('#athena-last-update'),updated);
});
test('live dial updates preserve nodes, keep overload readings and provide no adjustment controls',()=>{
 const {api,document,window,load}=overview(4),graphic=load.querySelector('svg'),readout=load.querySelector('output'),needle=load.querySelector('.athena-dial-needle');
 api.updateSummary({}, {load:[6*65536],memory:{total:1000,free:500}},[]);
 assert.equal(readout.textContent,'150%');assert.equal(needle.style.transform,'rotate(115deg)');
 assert.equal(load.querySelector('[role="slider"],input,button,[tabindex]'),null);
 for(const event of ['pointerdown','pointermove','wheel','keydown'])load.dispatchEvent(new window.Event(event,{bubbles:true}));
 assert.equal(readout.textContent,'150%');assert.equal(document.querySelectorAll('.athena-metric--dial').length,2);
 api.updateSummary({}, {load:[65536],memory:{total:1000,free:300}},[]);
 assert.equal(readout.textContent,'25%');assert.equal(load.querySelector('svg'),graphic);assert.equal(load.querySelector('output'),readout);assert.equal(load.querySelector('.athena-dial-needle'),needle);
});
test('missing CPU or memory metadata never becomes a fabricated utilization percentage',()=>{
 const {api,load,memory}=overview(0);
 api.updateSummary({}, {load:[65536]},[]);
 assert.equal(load.querySelector('output').textContent,'—%');assert.match(load.querySelector('.athena-metric-detail').textContent,/1\.00/);
 assert.equal(memory.querySelector('output').textContent,'—%');
 api.updateSummary({}, {memory:{total:1000,available:0}},[]);
 assert.equal(memory.querySelector('output').textContent,'100%');assert.match(load.querySelector('.athena-metric-detail').textContent,/等待负载数据/);
});
test('storage liquid follows actual usage while click motion settles without changing the reading',()=>{
 const {api,window,storage,frames,step}=overview(),level=storage.querySelector('.athena-liquid-level'),surface=storage.querySelector('.athena-liquid-surface'),wave=surface.getAttribute('d');
 api.updateSummary({}, {root:{total:100,used:69}},[]);
 assert.equal(storage.querySelector('output').textContent,'69%');assert.equal(level.style.transform,'translateY(141.98px)');assert.equal(storage.querySelector('.athena-dial-needle'),null);
 storage.dispatchEvent(new window.Event('click'));assert.equal(frames.size,1);step(1000);
 assert.notEqual(surface.getAttribute('d'),wave);assert.equal(storage.querySelector('output').textContent,'69%');assert.equal(level.style.transform,'translateY(141.98px)');
 for(let frame=1;frame<420&&frames.size;frame++)step(1000+frame*16.667);
 assert.equal(frames.size,0);assert.equal(surface.getAttribute('d'),wave);assert.equal(storage.style.getPropertyValue('--athena-liquid-tilt'),'0.000deg');
});
test('storage resize and keyboard impulses are bounded, and reduced motion stays still',()=>{
 const {window,storage,resize,step,frames}=overview();resize(200);assert.equal(frames.size,0);resize(280);assert.equal(frames.size,1);step(1000);
 assert.notEqual(storage.style.getPropertyValue('--athena-liquid-tilt'),'0.000deg');
 for(let index=0;index<30;index++){storage.dispatchEvent(new window.Event('click'));resize(280+index*5);step(1017+index*16.667);}
 assert(Math.abs(parseFloat(storage.style.getPropertyValue('--athena-liquid-tilt')))<=9);
 const calm=overview(2,true);calm.resize(200);calm.resize(320);calm.storage.dispatchEvent(new calm.window.Event('click'));
 const key=new calm.window.Event('keydown');key.key='Enter';calm.storage.dispatchEvent(key);
 assert.equal(calm.frames.size,0);assert.equal(calm.storage.dataset.liquidPaused,'true');
});
