import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';

const source=readFileSync(new URL('../htdocs/luci-static/athena/theme.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function theme({supported=true,reduced=false,defaultMode='system',savedMode='dark',systemDark=true,legacyMode=null,storageBlocked=false}={}) {
 const {document,window}=parseHTML(`<html data-theme-default="${defaultMode}"><body><input value="draft"><button data-theme-choice="light"></button><button data-theme-choice="dark"></button><button data-theme-choice="system"></button></body></html>`);
 const root=document.documentElement,stored=new Map(),transitions=[],animations=[],timers=new Map();let timer=0;
 if(savedMode!==null)stored.set('athena-mode',savedMode);if(legacyMode!==null)stored.set('heroui-mode',legacyMode);
 const media={matches:systemDark,addEventListener(type,fn){this.change=fn;}};
 window.matchMedia=query=>query.includes('color-scheme')?media:{matches:reduced,addEventListener(){}};window.innerWidth=1280;window.innerHeight=900;
 if(supported)document.startViewTransition=commit=>{
  let end;const result={ready:Promise.resolve().then(commit),finished:new Promise(resolve=>end=resolve),skipTransition(){this.skipped=true;end();},end(){end();}};transitions.push(result);return result;
 };
 root.animate=(frames,options)=>{let end;const result={frames,options,finished:new Promise(resolve=>end=resolve),end(){end();}};animations.push(result);return result;};
 new Function('document','window','localStorage','getComputedStyle','setTimeout','clearTimeout',source)(document,window,{getItem:key=>{if(storageBlocked)throw new Error('Storage unavailable');return stored.get(key);},setItem:(key,value)=>{if(storageBlocked)throw new Error('Storage unavailable');stored.set(key,value);}},()=>({getPropertyValue:()=> '#fff'}),fn=>{timers.set(++timer,fn);return timer;},id=>timers.delete(id));
 return {document,window,root,media,stored,transitions,animations,timers,pick:mode=>document.querySelector(`[data-theme-choice="${mode}"]`).click()};
}
test('theme reveal expands directly from the button and preserves form controls',async()=>{
 const {document,root,pick,transitions,animations,stored}=theme(),input=document.querySelector('input');
 pick('light');await flush();assert.equal(transitions.length,1);assert.equal(root.dataset.theme,'light');assert.equal(stored.get('athena-mode'),'light');
 const {frames,options}=animations[0];assert.equal(options.pseudoElement,'::view-transition-new(root)');assert.equal(frames.length,2);assert.match(frames[0].clipPath,/circle\(0px/);
 const end=frames.at(-1).clipPath.match(/circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/),circle={x:+end[2],y:+end[3],r:+end[1]};
 for(let x=0;x<=1280;x+=64)for(let y=0;y<=900;y+=45)assert(Math.hypot(x-circle.x,y-circle.y)<=circle.r,`coverage at ${x},${y}`);
 assert.equal(document.querySelector('input'),input);assert.equal(input.value,'draft');assert.equal(root.dataset.themeTransition,'droplet');
 animations[0].end();transitions[0].end();await flush();assert(!root.hasAttribute('data-theme-transition'));assert.equal(root.style.getPropertyValue('--athena-theme-clip'),undefined);
});
test('Droplet honors reduced motion and unsupported browsers without delaying mode changes',()=>{
 for(const options of [{reduced:true},{supported:false}]){const f=theme(options);f.pick('light');assert.equal(f.root.dataset.theme,'light');assert.equal(f.transitions.length,0);}
});
test('system mode stays available and external changes cancel a pending reveal',async()=>{
 const f=theme();f.pick('system');assert.equal(f.root.dataset.themeMode,'system');assert.equal(f.transitions.length,0);
 f.media.matches=false;f.media.change();assert.equal(f.root.dataset.theme,'light');f.pick('dark');await flush();assert.equal(f.root.dataset.themeTransition,'droplet');
 const event=new f.window.Event('storage');event.key='athena-mode';event.newValue='light';f.window.dispatchEvent(event);await flush();
 assert.equal(f.root.dataset.theme,'light');assert.equal(f.transitions[0].skipped,true);assert(!f.root.hasAttribute('data-theme-transition'));
});
test('Droplet watchdog always finishes the requested mode and removes its mask',async()=>{
 const f=theme();f.pick('light');await flush();for(const fn of [...f.timers.values()])fn();await flush();
 assert.equal(f.root.dataset.theme,'light');assert.equal(f.transitions[0].skipped,true);assert(!f.root.hasAttribute('data-theme-transition'));assert.equal(f.timers.size,0);
});
test('first visit follows the configured default and system is the initial fallback',()=>{
 for(const [defaultMode,systemDark,expected]of [['system',false,'light'],['system',true,'dark'],['dark',false,'dark'],['light',true,'light']]){
  const f=theme({defaultMode,savedMode:null,systemDark});assert.equal(f.root.dataset.themeMode,defaultMode);assert.equal(f.root.dataset.theme,expected);assert.equal(f.transitions.length,0);
  assert.equal(f.document.querySelector(`[data-theme-choice="${defaultMode}"]`).getAttribute('aria-pressed'),'true');
 }
 const f=theme({defaultMode:'invalid',savedMode:null,systemDark:false});assert.equal(f.root.dataset.themeMode,'system');assert.equal(f.root.dataset.theme,'light');
});
test('manual choice wins until it is removed, then configured default resumes',()=>{
 const f=theme({defaultMode:'dark',savedMode:'light'});assert.equal(f.root.dataset.theme,'light');
 f.stored.delete('athena-mode');const event=new f.window.Event('storage');event.key='athena-mode';event.newValue=null;f.window.dispatchEvent(event);
 assert.equal(f.root.dataset.themeMode,'dark');assert.equal(f.root.dataset.theme,'dark');
});
test('invalid or unavailable storage uses the configured default without legacy theme overrides',()=>{
 for(const options of [{savedMode:'invalid'},{savedMode:null,storageBlocked:true},{savedMode:null,legacyMode:'dark'}]){
  const f=theme({defaultMode:'light',...options});assert.equal(f.root.dataset.themeMode,'light');assert.equal(f.root.dataset.theme,'light');
 }
});
