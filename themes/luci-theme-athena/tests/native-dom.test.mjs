import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const translations=JSON.parse(readFileSync(new URL('./translations.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../htdocs/luci-static/resources/athena/ui.js',import.meta.url),'utf8');
function fixture(markup,page='admin-system-package-manager',lang='zh-cn') {
 const {document,window}=parseHTML(`<html lang="${lang}"><body data-page="${page}"><main id="maincontent">${markup}</main></body></html>`);
 document.documentElement.lang=lang;
 window.getComputedStyle=node=>({overflowX:node.style.overflowX||node.style.overflow||'visible',overflowY:node.style.overflowY||node.style.overflow||'visible'});
 window.HTMLElement.prototype.getBoundingClientRect=()=>({top:20,left:30,right:930,width:900,height:300});
 const E=(tag,attrs={},children=[])=>{const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(typeof value==='function')node.addEventListener(key,value);else if(value!=null)node.setAttribute(key,String(value));}for(const item of [children].flat(Infinity))if(item!=null)node.append(typeof item==='object'?item:document.createTextNode(String(item)));return node;};
 const exported=source.replace('return baseclass.extend({','return {tables,controls,modal,pages,scrollShadow,scrollShadows,tabMenus,prepareScrollSurface,syncScrollSurface};\nreturn baseclass.extend({');
 const instances=new Map();
 const api=new Function('document','window','dom','baseclass','ui','E','_','ResizeObserver','requestAnimationFrame','innerWidth','innerHeight',exported)(document,window,{findClassInstance:node=>instances.get(node)},{},{},E,s=>lang.startsWith('zh')?(translations[s]||s):s,class {observe(){}},fn=>queueMicrotask(fn),1280,900);
 return {document,window,api,instances,main:document.querySelector('main')};
}
test('native command completion removes its loading line, not theme chrome',()=>{
 const {document,api}=fixture('');
 document.body.classList.add('modal-overlay-active');
 const overlay=document.createElement('div');overlay.id='modal_overlay';overlay.innerHTML='<div class="modal"><h4>Executing package manager</h4><p class="spinning">Waiting…</p></div>';document.body.append(overlay);
 const dialog=overlay.firstElementChild, heading=dialog.firstChild, loading=dialog.lastChild;
 api.modal();
 assert.equal(overlay.firstElementChild,dialog);
 assert.equal(dialog.firstChild,heading);assert.equal(dialog.lastChild,loading);
 assert(heading.classList.contains('modal__header'));assert.equal(dialog.dataset.athenaFooter,'false');
 assert.equal(document.querySelector('.athena-modal-close').parentElement,overlay);
 // Exact native package-manager completion contract, for both success/error output.
 dialog.removeChild(dialog.lastChild);const output=document.createElement('pre');output.textContent='wget exited with error 4';dialog.append(output);
 const footer=document.createElement('div');footer.className='button-row';const dismiss=document.createElement('button');dismiss.textContent='Close';footer.append(dismiss);dialog.append(footer);
 api.modal();api.modal();
 assert.equal(dialog.querySelectorAll('.spinning').length,0);assert.equal(dialog.lastChild,footer);
 assert(footer.classList.contains('athena-modal-footer'));assert.equal(dialog.dataset.athenaFooter,'true');
 assert.equal(overlay.querySelectorAll('.athena-modal-close').length,1);assert.equal(overlay.querySelectorAll('.athena-modal-frame').length,1);
 assert.equal(overlay.querySelector('.athena-modal-close').disabled,false);
});
test('HeroUI scroll states follow horizontal and vertical edges and clear without overflow',()=>{
 const {api,main,window}=fixture('<div class="scroller" style="overflow:auto"><div>Content</div></div>');
 const node=main.firstElementChild;
 for(const [key,value] of Object.entries({clientWidth:200,scrollWidth:500,clientHeight:100,scrollHeight:100,scrollTop:0,scrollLeft:0}))Object.defineProperty(node,key,{value,writable:true,configurable:true});
 api.scrollShadow(node);assert(node.classList.contains('scroll-shadow--horizontal'));assert.equal(node.getAttribute('data-right-scroll'),'true');
 node.scrollLeft=100;node.dispatchEvent(new window.Event('scroll'));assert.equal(node.getAttribute('data-left-right-scroll'),'true');assert(!node.hasAttribute('data-right-scroll'));
 node.scrollLeft=300;node.dispatchEvent(new window.Event('scroll'));assert.equal(node.getAttribute('data-left-scroll'),'true');
 node.scrollWidth=200;node.scrollHeight=400;node.scrollTop=50;node.dispatchEvent(new window.Event('scroll'));assert(node.classList.contains('scroll-shadow--vertical'));assert.equal(node.getAttribute('data-top-bottom-scroll'),'true');assert(!node.hasAttribute('data-left-scroll'));
 node.scrollHeight=100;node.scrollTop=0;node.dispatchEvent(new window.Event('scroll'));assert(![...node.attributes].some(a=>/^data-(top|bottom|left|right).*scroll$/.test(a.name)));
 const tabs=main.ownerDocument.createElement('ul');tabs.className='cbi-tabmenu tabs__list';main.append(tabs);api.scrollShadow(tabs);assert.equal(tabs.getAttribute('data-orientation'),'horizontal');
});
test('shared table overflow follows content width and clears hidden vertical offsets',()=>{
 const {api,main,window}=fixture('<div class="table__scroll-container" style="overflow:auto"><table><tr><th>Original header</th></tr></table></div>');
 const node=main.firstElementChild,header=node.querySelector('th');
 for(const [key,value] of Object.entries({clientWidth:300,scrollWidth:300,clientHeight:180,scrollHeight:182,scrollTop:2,scrollLeft:0}))Object.defineProperty(node,key,{value,writable:true,configurable:true});
 api.scrollShadow(node);assert.equal(node.getAttribute('data-athena-overflow-x'),'false');assert.equal(node.scrollTop,0);assert(!node.hasAttribute('data-right-scroll'));
 node.scrollWidth=600;node.dispatchEvent(new window.Event('scroll'));assert.equal(node.getAttribute('data-athena-overflow-x'),'true');assert.equal(node.getAttribute('data-right-scroll'),'true');
 node.scrollLeft=120;node.scrollTop=1;node.dispatchEvent(new window.Event('scroll'));assert.equal(node.scrollTop,0);assert.equal(node.scrollLeft,120);assert.equal(node.getAttribute('data-left-right-scroll'),'true');
 node.scrollWidth=300;node.scrollLeft=0;api.scrollShadow(node);assert.equal(node.getAttribute('data-athena-overflow-x'),'false');assert(!node.hasAttribute('data-left-right-scroll'));assert.equal(node.querySelector('th'),header);
});
test('floating scroll surfaces stay below the original menu and clean up on close or removal',()=>{
 const {api,main,document,window}=fixture('<div class="cbi-dropdown"><ul class="dropdown"><li>Original option</li></ul></div>');
 const menu=main.querySelector('ul'),item=menu.firstElementChild,host=menu.parentElement,opened=new Set(),order=[];
 const proto=window.HTMLElement.prototype,original={showPopover:proto.showPopover,hidePopover:proto.hidePopover,matches:proto.matches};
 try {
  proto.showPopover=function(){opened.add(this);order.push(this);};
  proto.hidePopover=function(){opened.delete(this);};
  proto.matches=function(selector){return selector===':popover-open'?opened.has(this):original.matches.call(this,selector);};
  api.prepareScrollSurface(menu);api.prepareScrollSurface(menu);menu.showPopover();api.syncScrollSurface(menu);
  const surface=document.querySelector('.athena-scroll-surface');
  assert(surface);assert.deepEqual(order,[surface,menu]);assert.equal(document.querySelectorAll('.athena-scroll-surface').length,1);
  assert.equal(surface.parentElement,document.body);assert.equal(surface.getAttribute('aria-hidden'),'true');assert.equal(surface.style.width,'900px');
  assert.equal(menu.parentElement,host);assert.equal(host.lastElementChild,menu);assert.equal(menu.firstElementChild,item);assert.equal(menu.children.length,1);
  menu.hidePopover();api.syncScrollSurface(menu);assert(!surface.isConnected);assert(!menu.hasAttribute('data-athena-scroll-surface'));assert.equal(opened.size,0);
  api.prepareScrollSurface(menu);menu.showPopover();menu.remove();api.syncScrollSurface(menu);assert.equal(document.querySelectorAll('.athena-scroll-surface').length,0);
 } finally {
  for(const [key,value]of Object.entries(original))if(value===undefined)delete proto[key];else proto[key]=value;
 }
});
test('tab overflow preserves native siblings and selection while arrows follow scroll edges',()=>{
 const {api,main,window}=fixture('<ul class="cbi-tabmenu" style="overflow:auto"><li class="cbi-tab" data-tab="general"><a href="#">General</a></li><li class="cbi-tab-disabled" data-tab="advanced"><a href="#">Advanced</a></li></ul><div><section data-tab="general" data-tab-active="true"></section><section data-tab="advanced"></section></div>');
 const menu=main.firstElementChild,group=menu.nextElementSibling,tabs=[...menu.querySelectorAll('a')];
 for(const [key,value] of Object.entries({clientWidth:200,scrollWidth:600,clientHeight:40,scrollHeight:40,scrollTop:0,scrollLeft:0}))Object.defineProperty(menu,key,{value,writable:true,configurable:true});
 menu.getBoundingClientRect=()=>({left:0,top:0,right:200,width:200,height:40});
 tabs.forEach((tab,i)=>tab.getBoundingClientRect=()=>({left:24+i*350-menu.scrollLeft,right:100+i*350-menu.scrollLeft}));
 menu.scrollBy=({left})=>{menu.scrollLeft=Math.max(0,Math.min(400,menu.scrollLeft+left));menu.dispatchEvent(new window.Event('scroll'));};
 // Same sibling and event-target contract as LuCI UI.tabs.switchTab().
 tabs[1].addEventListener('click',event=>{event.preventDefault();const item=event.target.parentNode,rail=item.parentNode;rail.querySelector('.cbi-tab').className='cbi-tab-disabled';item.className='cbi-tab';rail.nextElementSibling.querySelector('[data-tab="advanced"]').setAttribute('data-tab-active','true');});
 api.tabMenus(main);api.tabMenus(main);
 const layer=menu.previousElementSibling,previous=layer.querySelector('.tabs__list-container__scroll-prev'),next=layer.querySelector('.tabs__list-container__scroll-next');
 assert.equal(menu.nextElementSibling,group);assert.equal(group.previousElementSibling,menu);assert.equal(main.querySelectorAll('.athena-tabs-overflow').length,1);assert.equal(menu.children.length,2);
 assert(previous.hidden);assert(!next.hidden);next.click();assert.equal(menu.scrollLeft,140);assert(!previous.hidden);assert(!next.hidden);
 tabs[1].click();api.tabMenus(main);assert.equal(group.lastElementChild.dataset.tabActive,'true');assert.equal(main.querySelectorAll('a')[1],tabs[1]);assert(menu.scrollLeft>=274);
 menu.scrollLeft=400;menu.dispatchEvent(new window.Event('scroll'));assert(!previous.hidden);assert(next.hidden);
 previous.click();assert.equal(menu.scrollLeft,260);assert(!next.hidden);
 menu.clientWidth=150;api.tabMenus(main);assert(menu.scrollLeft>=274,'resizing keeps the active tab visible');
 menu.scrollWidth=150;api.tabMenus(main);assert(previous.hidden);assert(next.hidden);
 menu.remove();api.tabMenus(main);assert.equal(main.querySelectorAll('.athena-tabs-overflow').length,0);
});
test('header-cloned data cells lose header styles and stay original nodes',()=>{
 const {api,main}=fixture('<table id="packages" class="table"><tr><th>Name</th><th>Description</th><th>Actions</th></tr><tr><td class="table__column">x</td><td class="table__column">long text</td><td class="table__column">Install</td></tr></table>');
 const cell=main.querySelector('td');api.tables(main);api.tables(main);
 assert.equal(main.querySelector('td'),cell);assert.equal(cell.classList.contains('table__column'),false);assert(cell.classList.contains('table__cell'));
 assert.equal(main.querySelectorAll('.athena-table').length,1);
});
test('Typography styles native content by role without changing its nodes or semantics',()=>{
 const {api,main}=fixture('<h2 id="title">Settings</h2><section class="card"><h3>Panel</h3><p>Body</p><div class="cbi-value-description">Help</div><code>eth0</code></section><div class="modal"><h4>Dialog</h4></div>');
 const title=main.querySelector('#title'),code=main.querySelector('code');api.controls(main);api.controls(main);
 assert.equal(main.querySelector('#title'),title);assert.equal(title.tagName,'H2');assert(title.classList.contains('typography--h2'));
 assert(main.querySelector('h3').classList.contains('typography--h5'));assert(main.querySelector('p').classList.contains('typography--body-sm'));
 assert(main.querySelector('.cbi-value-description').classList.contains('typography--body-xs'));assert(main.querySelector('.modal>h4').classList.contains('typography--h4'));
 assert.equal(main.querySelector('code'),code);assert(code.classList.contains('typography--code'));assert.equal(code.textContent,'eth0');
});
test('overview details keep semantic headings and original polling containers without nested cards',()=>{
 const {api,main,document}=fixture('<div id="view"><div class="cbi-section"><div class="cbi-title"><h3>System<span data-indicator="poll-status" data-clickable="true" data-style="inactive">Hide</span></h3></div><div id="poll-content"><table class="table"><tr><td>Hostname</td><td>OpenWrt</td></tr></table></div></div></div>','admin-status-overview');
 const view=main.querySelector('#view'),section=view.firstElementChild,heading=section.querySelector('h3'),content=main.querySelector('#poll-content'),toggle=heading.querySelector('span');let clicks=0;toggle.addEventListener('click',()=>clicks++);
 api.pages(main);api.controls(main);api.tables(main);api.pages(main);api.controls(main);
 assert.equal(main.querySelectorAll('.athena-details').length,1);assert.equal(main.querySelectorAll('.card,.athena-card').length,0);
 assert.equal(main.querySelector('.athena-details > h2').textContent,'设备详情');assert(main.querySelector('.athena-details > h2').classList.contains('typography--h2'));
 assert.equal(main.querySelector('.athena-details > #view'),view);assert.equal(view.firstElementChild,section);assert.equal(section.lastElementChild,content);assert.equal(section.querySelector('h3'),heading);assert(heading.classList.contains('typography--h3'));
 const update=document.createElement('table');update.className='table';update.innerHTML='<tr><td>Hostname</td><td>Updated</td></tr>';content.replaceChildren(update);api.pages(main);api.controls(main);api.tables(main);
 assert.equal(section.lastElementChild,content);assert.equal(content.querySelector('table'),update);assert.equal(main.querySelectorAll('.athena-details').length,1);toggle.click();assert.equal(clicks,1);assert.equal(toggle.getAttribute('aria-expanded'),'true');
});
test('reboot preserves native content and a large action without a theme panel',()=>{
 const {api,main}=fixture('<div id="view"><h2>Reboot</h2><p>Reboots the operating system</p><p class="alert-message warning">Unsaved changes will be lost</p><hr><button class="cbi-button cbi-button-action important">Perform reboot</button></div>','admin-system-reboot');
 const action=main.querySelector('button'),warning=main.querySelector('.warning');let calls=0;action.addEventListener('click',()=>calls++);
 api.pages(main);api.controls(main);api.pages(main);api.controls(main);
 assert.equal(main.querySelectorAll('.card,svg').length,0);assert.equal(main.querySelector('#view > button'),action);
 assert.equal(main.querySelector('#view > .warning'),warning);assert(main.querySelector('#view > h2'));
 assert(action.classList.contains('button--lg'));assert(!action.classList.contains('button--sm'));action.click();assert.equal(calls,1);
});
test('handle-to-handle drop selects direction before the native drop handler runs',()=>{
 const {api,main,window}=fixture('<table class="table"><tbody><tr class="cbi-section-table-row" data-sid="a"><td>A</td><td><button class="drag-handle" draggable="true">Sort</button></td></tr><tr class="cbi-section-table-row" data-sid="b"><td>B</td><td><button class="drag-handle" draggable="true">Sort</button></td></tr></tbody></table>');
 const rows=[...main.querySelectorAll('tr')],handles=[...main.querySelectorAll('button')];api.tables(main);api.tables(main);
 handles[0].dispatchEvent(new window.Event('dragstart',{bubbles:true}));handles[1].dispatchEvent(new window.Event('drop',{bubbles:true}));assert(rows[1].classList.contains('drag-over-below'));
 handles[1].dispatchEvent(new window.Event('dragstart',{bubbles:true}));handles[0].dispatchEvent(new window.Event('drop',{bubbles:true}));assert(rows[0].classList.contains('drag-over-above'));
 rows[0].parentElement.insertBefore(rows[1],rows[0]);api.tables(main);
 assert.equal(rows[1].dataset.athenaFirstRow,'true');assert.equal(rows[0].hasAttribute('data-athena-first-row'),false);
});
test('native table placeholders span every column; div placeholders get shared empty marker',()=>{
 const {api,main}=fixture('<table class="table"><tr><th>1</th><th>2</th><th>3</th><th>4</th></tr><tr class="tr placeholder"><td><em>No entries</em></td></tr></table><div class="table"><div class="tr"><div class="th">A</div><div class="th">B</div></div><div class="tr placeholder"><div class="td"><em>No configuration</em></div></div></div>');
 api.tables(main);assert.equal(main.querySelector('td').getAttribute('colspan'),'4');
 assert.equal(main.querySelectorAll('[data-athena-empty="true"] > .athena-empty-cell').length,2);
 const row=main.querySelector('tr.placeholder'),cell=row.firstElementChild;row.classList.remove('placeholder');cell.removeAttribute('colspan');cell.textContent='Configured';row.append(main.ownerDocument.createElement('td'));api.tables(main);
 assert(!row.hasAttribute('data-athena-empty'));assert(!cell.classList.contains('athena-empty-cell'));assert.equal(row.closest('.athena-table').getAttribute('data-athena-empty-table'),'false');
});
test('shared table layouts recognize metrics and key-value rows without page-specific selectors',()=>{
 const {api,main}=fixture('<table class="table" id="metrics" style="table-layout:fixed"><tr><td><strong>UDP</strong></td><td id="current">2</td><td><strong>Average</strong></td><td>1</td><td><strong>Peak</strong></td><td>4</td></tr></table><table class="table" id="details"><tr><td>Firmware</td><td>Long firmware version</td></tr></table>','admin-custom-view');
 const value=main.querySelector('#current'),rows=[...main.querySelectorAll('tr')];api.tables(main);api.tables(main);
 assert.equal(main.querySelector('#metrics').closest('.athena-table').getAttribute('data-athena-table-layout'),'metrics');
 assert.equal(main.querySelector('#details').closest('.athena-table').getAttribute('data-athena-table-layout'),'key-value');
 assert.equal(value.getAttribute('data-athena-cell'),'number');value.textContent='12';api.tables(main);assert.equal(main.querySelector('#current'),value);assert.equal(value.textContent,'12');
 assert.deepEqual([...main.querySelectorAll('tr')],rows);assert.equal(main.querySelectorAll('.athena-table').length,2);
});
test('shared data table roles preserve addresses, actions, editable rows and empty states',()=>{
 const {api,main}=fixture('<table class="table"><tr><th>Protocol</th><th>Address</th><th>Value</th><th>Actions</th></tr><tr id="data"><td>TCP</td><td>192.168.1.2:8080</td><td>12.5%</td><td class="cbi-section-actions"><button>Edit</button></td></tr></table><table class="table"><tr><td>Name</td><td><input value="draft"></td></tr></table><table class="table"><tr class="placeholder"><td><em>No entries</em></td></tr></table>');
 const address=main.querySelector('#data').children[1],action=main.querySelector('button'),input=main.querySelector('input');api.tables(main);
 const wrappers=[...main.querySelectorAll('.athena-table')];assert.equal(wrappers[0].getAttribute('data-athena-table-layout'),'data');assert.equal(wrappers[0].style.getPropertyValue('--athena-table-columns'),'4');
 assert.equal(address.getAttribute('data-athena-cell'),'identifier');assert.equal(main.querySelector('#data').children[2].getAttribute('data-athena-cell'),'number');assert.equal(action.parentElement.getAttribute('data-athena-cell'),'actions');
 assert.equal(wrappers[1].getAttribute('data-athena-table-layout'),'data');assert.equal(main.querySelector('input'),input);assert.equal(input.value,'draft');assert.equal(wrappers[2].getAttribute('data-athena-empty-table'),'true');
 address.textContent='[fe80::1%eth0]:546';api.tables(main);assert.equal(address.getAttribute('data-athena-cell'),'identifier');assert.equal(main.querySelector('#data').children[1],address);
});
test('table progress descriptions use normal flow while native bars keep their nodes and updates',()=>{
 const {api,main}=fixture('<table class="table"><tr><td>Memory</td><td><div class="cbi-progressbar" title="132 MiB / 482 MiB (27%)"><div style="width:27%"></div></div></td></tr></table>');
 const bar=main.querySelector('.cbi-progressbar'),fill=bar.firstElementChild;api.tables(main);api.tables(main);
 const output=bar.nextElementSibling;assert(output.classList.contains('athena-progress-output'));assert.equal(output.textContent,bar.title);assert.equal(main.querySelectorAll('.athena-progress-output').length,1);
 bar.title='160 MiB / 482 MiB (33%)';fill.style.width='33%';api.tables(main);assert.equal(output.textContent,bar.title);assert.equal(bar.firstElementChild,fill);assert.equal(main.querySelector('.cbi-progressbar'),bar);
});
test('all native dmesg boolean inputs become switches without replacing them',()=>{
 const {api,main}=fixture('<div id="content_syslog"><div><label>Exclude</label><input type="checkbox" id="invertSeverity"></div><div><label>Sort</label><input type="checkbox" id="invertAscendingSort"></div></div>','admin-status-logs-dmesg');
 const inputs=[...main.querySelectorAll('input')];api.controls(main);api.controls(main);
 assert.equal(main.querySelectorAll('.athena-switch').length,2);assert.deepEqual([...main.querySelectorAll('input')],inputs);
});
test('boolean table filter preserves its native value and reset-all state',async()=>{
 const {api,main,window}=fixture('<table class="table"><tr class="cbi-section-table-titles"><th data-widget="CBI.FlagValue">Masquerading</th><th>Actions</th></tr><tr class="cbi-section-table-filter"><th><input class="cbi-section-filter" placeholder="0/1" maxlength="1" value=""></th><th><button>Reset</button></th></tr></table>');
 const input=main.querySelector('input'),reset=main.querySelector('button');
 reset.addEventListener('click',()=>{input.value='';input.dispatchEvent(new window.Event('input',{bubbles:true}));});
 api.controls(main);api.controls(main);assert.equal(input.type,'checkbox');assert.equal(input.value,'');
 const all=main.querySelector('.athena-filter-all');
 assert.equal(all.textContent,'全部');assert.equal(all.getAttribute('aria-pressed'),'true');
 assert.equal(all.previousElementSibling.className,'switch__control');assert.equal(main.querySelectorAll('.athena-filter-all').length,1);
 assert.equal(input.closest('.athena-filter-switch').dataset.filterState,'all');
 input.checked=true;input.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(input.value,'1');
 assert.equal(all.getAttribute('aria-pressed'),'false');
 input.checked=false;input.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(input.value,'0');
 all.click();assert.equal(input.value,'');assert.equal(all.getAttribute('aria-pressed'),'true');assert.equal(input.checked,false);
 input.checked=true;input.dispatchEvent(new window.Event('input',{bubbles:true}));
 reset.click();await new Promise(resolve=>queueMicrotask(resolve));
 assert.equal(input.closest('.athena-filter-switch').dataset.filterState,'all');assert.equal(main.querySelector('input'),input);
 assert.equal(all.getAttribute('aria-pressed'),'true');
 assert.equal(main.querySelectorAll('.athena-filter-caption').length,0);
});
test('All clears only its boolean column and emits the native unfiltered input value',()=>{
 const {api,main,window}=fixture('<table class="table"><tr class="cbi-section-table-titles"><th>Name</th><th>Enabled</th><th>Masquerading</th></tr><tr class="cbi-section-table-filter"><th><input class="cbi-section-filter" value="lan"></th><th><input class="cbi-section-filter" placeholder="0/1" maxlength="1" value="1"></th><th><input class="cbi-section-filter" placeholder="0/1" maxlength="1" value="0"></th></tr></table><table class="table"><tr class="cbi-section-table-filter"><th><input class="cbi-section-filter" placeholder="0/1" maxlength="1" value="1"></th></tr></table>');
 const inputs=[...main.querySelectorAll('input')],events=[];
 main.addEventListener('input',event=>events.push([inputs.indexOf(event.target),event.target.value]));
 api.controls(main);api.controls(main);
 const all=inputs[2].closest('.athena-filter-switch').querySelector('.athena-filter-all');
 all.click();assert.deepEqual(inputs.map(input=>input.value),['lan','1','','1']);assert.deepEqual(events,[[2,'']]);
 assert.equal(all.getAttribute('aria-pressed'),'true');assert.equal(main.querySelectorAll('.athena-filter-all').length,3);
 inputs[2].checked=true;inputs[2].dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.deepEqual(events,[[2,''],[2,'1']]);assert.equal(all.getAttribute('aria-pressed'),'false');
 assert(!inputs[2].closest('table').hasAttribute('data-athena-filter-resetting'));assert.deepEqual([...main.querySelectorAll('input')],inputs);
});
test('All follows disabled state and uses the English filter label',()=>{
 const {api,main}=fixture('<table class="table"><tr class="cbi-section-table-filter"><th><input class="cbi-section-filter" placeholder="0/1" maxlength="1" value="1" disabled></th></tr></table>','admin-network-firewall','en');
 const input=main.querySelector('input');api.controls(main);const all=main.querySelector('.athena-filter-all');
 assert.equal(all.textContent,'All');assert.match(all.getAttribute('aria-label'),/^All/);
 assert.equal(all.disabled,true);all.click();assert.equal(input.value,'1');
 input.disabled=false;api.controls(main);assert.equal(all.disabled,false);all.click();assert.equal(input.value,'');
});
test('custom dropdown Add uses the original input, native validation and create flow',()=>{
 const {api,main,instances}=fixture('<div class="cbi-dropdown"><ul><li unselectable><input class="create-item-input" value="512"></li></ul></div>');
 const dropdown=main.firstElementChild,input=main.querySelector('input');const values=[];
 input.checkValidity=()=>true;
 instances.set(dropdown,{options:{},handleCreateBlur:()=>{},createItems:(node,value)=>{assert.equal(node,dropdown);values.push(value);}});
 api.controls(main);api.controls(main);
 const add=main.querySelector('.athena-choice-add');assert(add);assert.equal(add.previousElementSibling,input);assert.equal(main.querySelectorAll('.athena-choice-add').length,1);
 add.click();assert.deepEqual(values,['512']);assert.equal(input.value,'');assert(add.disabled);
 input.value='bad';input.classList.add('cbi-input-invalid');add.click();assert.deepEqual(values,['512']);
});
test('log scroll actions move the original textarea to both ends',()=>{
 const {api,main}=fixture('<button id="scrollDownButton">Down</button><textarea id="syslog"></textarea><button id="scrollUpButton">Up</button>','admin-status-logs-syslog');
 const area=main.querySelector('textarea');area.scrollHeight=12000;area.scrollTop=0;
 api.pages(main);main.querySelector('#scrollDownButton').click();assert.equal(area.scrollTop,12000);
 main.querySelector('#scrollUpButton').click();assert.equal(area.scrollTop,0);
});
test('dmesg compact layout preserves filter nodes and moves sort beside the log action',()=>{
 const {api,main}=fixture('<div id="content_syslog"><div><input id="logFromTime" type="number"><input id="logToTime" type="number"><input id="invertLogRangeTime" type="checkbox"></div><div><select id="logSeveritySelect"></select><input id="invertSeverity" type="checkbox"></div><div><input id="invertAscendingSort" type="checkbox"></div><div><input id="logTextFilter"><input id="invertLogTextSearch" type="checkbox"></div><div><button id="scrollDownButton">Down</button></div><textarea id="syslog"></textarea></div>','admin-status-logs-dmesg');
 const original=[...main.querySelectorAll('input,select')];api.pages(main);api.controls(main);api.pages(main);
 assert.equal(main.querySelectorAll('.athena-log-filters--dmesg > .athena-log-field').length,3);
 assert.equal(main.querySelector('#invertAscendingSort').closest('.athena-log-toolbar'),main.querySelector('#scrollDownButton').parentElement);
 assert(original.every(node=>main.contains(node)));assert.equal(main.querySelectorAll('.athena-switch').length,4);
});
test('diagnostic layout keeps native target/action sibling contracts and one shared panel',()=>{
 const {api,main}=fixture('<div id="view"><div class="cbi-map"><table class="table"><tr class="tr"><td class="td"><input value="127.0.0.1"><span class="diag-action"><div class="cbi-dropdown cbi-button btn"><ul><li display="0">IPv4 Ping</li></ul><span class="open">Open</span></div></span></td><td class="td"><input value="localhost"><span class="diag-action"><button class="cbi-button">Nslookup</button></span></td></tr></table><div class="cbi-section"><div id="command-output"><textarea readonly></textarea></div></div></div></div>','admin-network-diagnostics');
 const fields=[...main.querySelectorAll('input')],actions=[...main.querySelectorAll('.diag-action')],buttons=actions.map(n=>n.firstElementChild),targets=[];
 buttons.forEach(button=>button.addEventListener('click',event=>targets.push(event.currentTarget.parentNode.previousSibling.value)));
 api.pages(main);api.controls(main);api.pages(main);api.controls(main);api.tables(main);
 assert.equal(main.querySelectorAll('.athena-diagnostics-panel').length,1);assert.equal(main.querySelectorAll('.athena-diagnostic-heading').length,2);
 fields.forEach((field,index)=>{assert.equal(actions[index].previousSibling,field);assert.equal(actions[index].parentElement,field.parentElement);});
 assert.equal(main.querySelectorAll('.athena-diagnostics-panel input').length,2);assert.equal(main.querySelectorAll('.athena-table').length,0);
 assert(buttons[0].classList.contains('button--md'));assert.equal(buttons[0].classList.contains('button--lg'),false);
 buttons.forEach(button=>button.click());assert.deepEqual(targets,['127.0.0.1','localhost']);
 assert(main.querySelector('#command-output textarea').hasAttribute('readonly'));assert(main.querySelector('#command-output textarea').getAttribute('placeholder'));
});
test('syslog keeps source filter inputs and moves row limit to the log toolbar',()=>{
 const {api,main}=fixture('<div id="content_syslog"><div><select id="logFacilitySelect"></select><input id="invertLogFacilitySearch" type="checkbox"></div><div><select id="logSeveritySelect"></select><input id="invertLogSeveritySearch" type="checkbox"></div><div><input id="logTextFilter"><input id="invertLogTextSearch" type="checkbox"></div><div><input type="number" id="logMaxRows" value="50"></div><div><button id="scrollDownButton">Down</button></div><textarea id="syslog"></textarea></div>','admin-status-logs-syslog');
 const limit=main.querySelector('#logMaxRows'),fields=[...main.querySelectorAll('input,select')];
 api.pages(main);api.controls(main);api.pages(main);
 assert.equal(main.querySelectorAll('.athena-log-filters--syslog > .athena-log-field').length,3);
 assert.equal(limit.closest('.athena-log-toolbar'),main.querySelector('#scrollDownButton').parentElement);assert.equal(limit.value,'50');
 assert(fields.every(node=>main.contains(node)));assert.equal(main.querySelectorAll('.athena-switch').length,3);
});
test('package toolbar keeps native controls, progress updates and pager parents',()=>{
 const {api,main}=fixture('<div class="cbi-section"><div class="controls"><div><label id="disk-space-label">Disk space</label><div class="cbi-progressbar" title="68% used"><div style="width:68%"></div></div></div><div><label id="filter-label">Filter</label><span class="control-group"><input name="filter"><button class="btn cbi-button">Clear</button></span></div><div><label id="download-label">Install</label><span class="control-group"><input name="install"><button class="btn cbi-button cbi-button-action">OK</button></span></div><div><label id="action-label">Actions</label><span class="control-group"><button class="btn cbi-button-positive" data-command="update">Update</button></span></div><div><label>Translations</label><div><label><input type="radio" name="filter_i18n" value="lang"> filtered</label> &nbsp; <label><input type="radio" name="filter_i18n" value="all">all</label></div></div></div></div><div class="controls"><div class="pager" data-offset="100"><button class="prev btn cbi-button">«</button><div class="text">Displaying 1-100</div><button class="next btn cbi-button">»</button></div></div>');
 const inputs=[...main.querySelectorAll('input')],fill=main.querySelector('.cbi-progressbar').firstElementChild,pager=main.querySelector('.pager'),text=pager.querySelector('.text').firstChild,clicks=[];
 const next=pager.querySelector('.next');next.addEventListener('click',event=>clicks.push(event.target.parentNode.getAttribute('data-offset')));
 api.pages(main);api.controls(main);api.pages(main);
 assert(inputs.every(input=>main.contains(input)));assert.equal(main.querySelector('.meter__fill'),fill);assert.equal(main.querySelectorAll('.athena-package-disk-summary').length,1);
 assert.equal(main.querySelector('[role="meter"]').getAttribute('aria-valuenow'),'68');assert(main.querySelector('[role="radiogroup"]').contains(inputs[2]));
 assert.equal(pager.querySelector('.text').firstChild,text);assert.equal(next.parentElement,pager);next.click();assert.deepEqual(clicks,['100']);
 const progress=main.querySelector('.cbi-progressbar');progress.setAttribute('title','75% used');fill.style.width='75%';api.pages(main);
 assert.equal(main.querySelector('.athena-package-disk-summary').textContent,'75% used');assert.equal(progress.getAttribute('aria-valuenow'),'75');
 assert(main.querySelector('.athena-package-install button').classList.contains('button--primary'));
});
test('SSH cards preserve native key refresh, input events and add-item as the last child',()=>{
 const {api,main,document}=fixture('<div class="cbi-dynlist"><div class="item" data-key="key1"><strong>Workstation</strong><br><small>ED25519<br><code>fingerprint</code></small></div><div class="add-item"><input type="text"><button>Add key</button></div></div>','admin-system-admin-sshkeys');
 const list=main.firstElementChild,add=list.lastElementChild,input=add.firstElementChild,submit=add.lastElementChild,key=list.firstElementChild,clicked=[];
 key.addEventListener('click',event=>clicked.push(event.target.getAttribute('data-key')));
 api.pages(main);api.controls(main);api.pages(main);
 assert.equal(list.lastElementChild,add);assert.equal(list.querySelector('input'),input);assert.equal(list.querySelector('.athena-ssh-add-actions button'),submit);
 assert.equal(main.querySelectorAll('.athena-ssh-existing').length,1);assert.equal(main.querySelectorAll('.athena-ssh-remove').length,1);
 main.querySelector('.athena-ssh-remove').click();assert.deepEqual(clicked,['key1']);
 // Native renderKeys(): remove everything before add-item, then insert fresh rows.
 while(!list.firstElementChild.matches('.add-item'))list.firstElementChild.remove();
 const replacement=document.createElement('div');replacement.className='item';replacement.innerHTML='<strong>New row</strong><br><small>metadata</small>';list.insertBefore(replacement,add);
 api.pages(main);api.controls(main);assert.equal(list.lastElementChild,add);assert(main.querySelector('.athena-ssh-existing').contains(replacement));assert.equal(list.querySelector('input'),input);
});
test('rich tooltip opens in the top layer without cloning or moving its source node',()=>{
 const {api,main,window}=fixture('<div class="ifacebox"><span class="cbi-tooltip-container"><img><span class="cbi-tooltip ifacebadge large">Device details</span></span></div>');
 const host=main.querySelector('.cbi-tooltip-container'),tip=main.querySelector('.cbi-tooltip');let opened=false;
 tip.showPopover=()=>{opened=true;};tip.hidePopover=()=>{opened=false;};
 const tipMatches=tip.matches.bind(tip),hostMatches=host.matches.bind(host);
 tip.matches=s=>s===':popover-open'?opened:tipMatches(s);host.matches=s=>s===':hover'?false:hostMatches(s);
 api.controls(main);host.dispatchEvent(new window.Event('mouseenter'));
 assert(opened);assert.equal(tip.parentElement,host);assert.equal(main.querySelectorAll('.cbi-tooltip').length,1);assert.equal(tip.style.position,'fixed');
 const leave=new window.Event('mouseleave');leave.relatedTarget=main;host.dispatchEvent(leave);assert.equal(opened,false);
});
test('alias route resolves the initially selected native tab',()=>{
 const menu=readFileSync(new URL('../htdocs/luci-static/resources/menu-athena.js',import.meta.url),'utf8');
 const fn=menu.slice(menu.indexOf('function currentPath()'),menu.indexOf('function active('));
 const path=new Function('location','L',fn+'return currentPath();')({pathname:'/cgi-bin/luci/admin/status/logs'},{env:{dispatchpath:['admin','status','logs','syslog']}});
 assert.equal(path,'admin/status/logs/syslog');
});
test('asset versioning affects only theme modules and restores the native cache version',()=>{
 const footer=readFileSync(new URL('../ucode/template/themes/athena/footer.ut',import.meta.url),'utf8');
 const script=footer.split('<script>')[1].split('</script>')[0];const loads=[];
 function LuCI(){};const L=new LuCI();L.env={resource_version:'native'};
 LuCI.prototype.require=function(name){loads.push([name,this.env.resource_version]);return Promise.resolve();};
 new Function('LuCI','L','document',script)(LuCI,L,{body:{dataset:{assetVersion:'123'}}});
 L.require('athena.ui');L.require('tools.widgets');L.require('view.firewall.zones');
 assert.deepEqual(loads,[['menu-athena','native-athena-123'],['athena.ui','native-athena-123'],['tools.widgets','native'],['view.firewall.zones','native']]);
 assert.equal(L.env.resource_version,'native');
});
test('failed theme stylesheet retries twice without reloading the page or replacing controls',()=>{
 const {document,window}=parseHTML('<html><head><link id="athena-stylesheet" href="/luci-static/athena/athena.css?v=123"></head><body><input value="draft"></body></html>');
 const timers=[];let loaded=false;window.matchMedia=()=>({matches:false,addEventListener(){}});window.location={href:'http://127.0.0.1:8080/cgi-bin/luci/admin'};
 const code=readFileSync(new URL('../htdocs/luci-static/athena/theme.js',import.meta.url),'utf8');
 new Function('document','window','localStorage','getComputedStyle','setTimeout',code)(document,window,{getItem:()=>null},()=>({getPropertyValue:()=>loaded?'#f6f7f9':''}),fn=>timers.push(fn));
 const link=document.querySelector('link'),input=document.querySelector('input');
 document.dispatchEvent(new window.Event('DOMContentLoaded'));assert.equal(timers.length,1);timers.shift()();assert.match(link.getAttribute('href'),/retry=1/);
 link.dispatchEvent(new window.Event('error',{bubbles:true}));timers.shift()();assert.match(link.getAttribute('href'),/retry=2/);
 link.dispatchEvent(new window.Event('error',{bubbles:true}));assert.equal(timers.length,0);assert.equal(document.querySelector('input'),input);assert.equal(input.value,'draft');
 loaded=true;link.dispatchEvent(new window.Event('load',{bubbles:true}));assert.equal(timers.length,0);
});
