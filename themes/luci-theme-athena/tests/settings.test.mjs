import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../htdocs/luci-static/resources/view/athena-config.js',import.meta.url),'utf8');

async function settings(name,readonly=false) {
 const {document}=parseHTML('<html lang="en"><body></body></html>');
 const E=(tag,attrs={},children=[])=>{const node=document.createElement(tag);for(const[key,value]of Object.entries(attrs))if(typeof value==='function')node.addEventListener(key,value);else if(value!=null)node.setAttribute(key,String(value));for(const item of [children].flat(Infinity))if(item!=null)node.append(typeof item==='object'?item:String(item));return node;};
 const methods=[];
 const rpc={declare:({method})=>{methods.push(method);return ()=>Promise.resolve({result:0,version:'0.0.6',available:1024,files:[]});}};
 class Map {section(){return {option(){return {value(){}};}};}render(){return Promise.resolve(E('div'));}}
 const children=name?{[name]:{title:'Software',satisfied:true}}:{};
 const api=new Function('document','view','form','rpc','uci','ui','widgets','E','_','L',source)(document,{extend:value=>value},{Map,NamedSection:class{}},rpc,{load:()=>Promise.resolve()}, {menu:{load:()=>Promise.resolve({children:{admin:{children:{system:{children}}}}})}}, {card:(heading,items)=>E('section',{},[heading,...items])},E,value=>value,{hasViewPermission:()=>!readonly,url:(...parts)=>'/cgi-bin/luci/'+parts.join('/')});
 await api.render(await api.load());
 return {api,methods};
}

test('upstream settings use the installed native package manager on both routes',async()=>{
 for(const name of ['package-manager','opkg']) {
  const {api,methods}=await settings(name);
  assert.equal(api.upgradeRoot.querySelector('a').getAttribute('href'),'/cgi-bin/luci/admin/system/'+name);
  assert.deepEqual(methods,['get','install','remove','select']);
  assert.equal(api.upgradeRoot.querySelector('button'),null);
 }
});
test('upstream settings do not create a broken software link without a package application',async()=>{
 const {api}=await settings(null);
 assert.equal(api.upgradeRoot.querySelector('a'),null);
 assert.match(api.upgradeRoot.textContent,/OpenWrt package manager/);
});
test('read-only upstream settings keep asset mutations disabled',async()=>{
 const {api}=await settings('opkg',true);
 for(const button of api.assetRoot.querySelectorAll('button'))assert(button.hasAttribute('disabled'));
});
