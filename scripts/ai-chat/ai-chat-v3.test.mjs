import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const Module = require('node:module');
const { load, mock } = require('../test-support/step2-load-ts.cjs');
let pathname = '/';
mock('next/navigation', { usePathname: () => pathname });
Module._extensions['.tsx'] = (mod, filename) => mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const actions = Object.fromEntries(['close','toggleMenu','locale','input','submit','stop','retry','confirm','contact','chip'].map(key => [key, () => {}]));
function panel(patch = {}) {
 const { ChatPanel } = load('components/ai-chat/ChatPanel.tsx');
 return render(React.createElement(ChatPanel, { locale:'zh-TW', messages:[], busy:false, input:'', issue:null, hint:null, menuOpen:false, summary:null, summaryRead:false, contacts:{line:null,whatsapp:null,wechat:null,phone:'02-2685-1666'}, actions, historyRef:React.createRef(), inputRef:React.createRef(), closeRef:React.createRef(), summaryStartRef:React.createRef(), summaryEndRef:React.createRef(), ...patch }));
}
const quote = input => ({ id:'q', role:'assistant', parts:[{type:'tool-get_quote', input, output:{kind:'quote',quote:{price_available:true,low:7000,high:8500,vehicle:'九人座'},notice:'SERVER_QUOTE_NOTICE'}}] });
const summaryText = '訂單摘要\n聯絡人：離線旅客\n聯絡方式：line offline_guest\n上車：台北 → 九份\n下車：九份\n日期時間：2099-12-04 09:00\n人數：4 人\n行李：6 件\n請回覆「我確認」。';
const summaryMessage = text => ({id:'s',role:'assistant',parts:[{type:'text',text}]});
test('v3 mobile flag accepts only trimmed lowercase panel',()=>{
 const { resolveMobileLayout }=load('components/ai-chat/layout.ts');
 for(const value of [undefined,'',' ','fullscreen','PANEL','Panel','other'])assert.equal(resolveMobileLayout(value),'fullscreen',String(value));
 for(const value of ['panel',' panel ','\tpanel\n'])assert.equal(resolveMobileLayout(value),'panel');
});
test('v3 widget root exposes the resolved build-time mobile layout',()=>{
 const Widget=load('components/AIChatWidget.tsx').default;
 const before=process.env.NEXT_PUBLIC_CHAT_MOBILE_LAYOUT;
 try {for(const value of ['','fullscreen','PANEL','other','panel',' panel ']){process.env.NEXT_PUBLIC_CHAT_MOBILE_LAYOUT=value;const html=render(React.createElement(Widget));assert.ok(html.includes('data-mobile-layout="'+(value.trim()==='panel'?'panel':'fullscreen')+'"'));}}
 finally {if(before===undefined)delete process.env.NEXT_PUBLIC_CHAT_MOBILE_LAYOUT;else process.env.NEXT_PUBLIC_CHAT_MOBILE_LAYOUT=before;}
});
test('v3 launcher follows all three initial URL locales and aria names',()=>{
 const Widget=load('components/AIChatWidget.tsx').default;
 for(const [url,label,aria,sub] of [['/','AI 旅遊管家','開啟 AI 旅遊管家','24 小時・繁中 / 简中 / EN'],['/zh-cn','AI 旅遊管家','开启 AI 旅游管家','24 小時・繁中 / 简中 / EN'],['/en','AI travel concierge','Open AI travel concierge','24/7 · 繁中 / 简中 / EN']]){pathname=url;const html=render(React.createElement(Widget));assert.ok(html.includes('>'+label+'</b>'));assert.ok(html.includes('aria-label="'+aria+'"'));assert.ok(html.includes(sub));}
});
test('v3 quote and booking use amber fy-pend, contacts keep fy-pending',()=>{
 const messages=[quote({passenger_count:4}),{id:'b',role:'assistant',parts:[{type:'tool-create_booking',output:{kind:'booking',booking_number:'FY-TEST-OFFLINE',notice:'SERVER_BOOKING_NOTICE'}}]}];
 const html=panel({messages});assert.equal((html.match(/class="fy-tag fy-pend"/g)||[]).length,2);assert.doesNotMatch(html,/fy-tag fy-pending/);assert.equal((html.match(/fy-contact fy-\w+ fy-pending/g)||[]).length,3);
});
test('v3 passengers use actual total schema count, optional luggage uses units without inventing adults',()=>{
 for(const [locale,total,withBags] of [['zh-TW','4 人','4 人・行李 6 件'],['zh-CN','4 人','4 人・行李 6 件'],['en','4 passengers','4 passengers · 6 bags']]){
  const html=panel({locale,messages:[quote({passenger_count:4})]});assert.ok(html.includes(total));assert.doesNotMatch(html,/4 (?:位大人|adults)/);assert.ok(panel({locale,messages:[quote({passenger_count:4,luggage_count:6})]}).includes(withBags));
 }
 assert.match(panel({locale:'en',messages:[quote({passenger_count:1,luggage_count:1})]}),/1 passenger · 1 bag/);
 assert.match(panel({messages:[quote({passenger_count:4,luggage_count:0})]}),/4 人・行李 0 件/);
});
test('v3 summary shows supplied vehicle and exactly one fixed pending availability row in every locale',()=>{
 const { latestSummary }=load('components/ai-chat/viewModel.ts');
 for(const [locale,vehicle,availability,pending] of [['zh-TW','建議車型','車況','待專人確認'],['zh-CN','建议车型','车况','待专人确认'],['en','Vehicle','Availability','Pending staff confirmation']]){
  const text=summaryText+'\n建議車型：九人座保母車';const message=summaryMessage(text);const summary=latestSummary([message]);
  const html=panel({locale,messages:[message],summary});assert.ok(html.includes('<dt>'+vehicle+'</dt><dd>九人座保母車</dd>'));assert.ok(html.includes('<dt>'+availability+'</dt><dd class="fy-pc">'+pending+'</dd>'));
 }
});
test('v3 summary never guesses a vehicle when no recommendation was supplied',()=>{
 const {latestSummary}=load('components/ai-chat/viewModel.ts');const message=summaryMessage(summaryText);const html=panel({messages:[message],summary:latestSummary([message])});assert.doesNotMatch(html,/<dt>建議車型<\/dt>/);assert.match(html,/class="fy-pc">待專人確認/);
});
test('v3 raw summary fallback still contains pending availability',()=>{
 const text='Order summary: 2099-12-04 09:00, 4 passengers, 6 bags, LINE offline_guest, pick-up A → drop-off B';
 const {latestSummary}=load('components/ai-chat/viewModel.ts');const message=summaryMessage(text);const html=panel({locale:'en',messages:[message],summary:latestSummary([message])});assert.match(html,/fy-summary-raw/);assert.match(html,/class="fy-pc">Pending staff confirmation/);
});
test('v3 language labels, booking steps, footer and 413 copy match review',()=>{
 const {COPY,LANGUAGES}=load('components/ai-chat/copy.ts');assert.deepEqual(LANGUAGES.map(l=>[l.label,l.detail]),[['繁體中文','台灣'],['简体中文','简体'],['English','']]);
 assert.deepEqual(COPY.en.steps,['Our staff confirm vehicle availability',"We'll contact you via your preferred method","We'll send a formal quote and payment link"]);
 assert.equal(COPY.en.meta,'AI replies are for reference · staff confirm price');
 assert.ok(COPY['zh-TW'].longBody.includes('請縮短後再送出，或直接聯絡專人：'));assert.ok(COPY['zh-CN'].longBody.includes('请缩短后再发送，或直接联系专人：'));
});
test('v3 body unlock removes only an originally absent, now-empty style attribute',()=>{
 const {lockBodyScroll}=load('components/ai-chat/viewModel.ts');
 for(const initial of [null,'','color: red;']){
  const values=new Map(initial? [['color','red']]:[]);let attribute=initial;const removed=[];
  const body={getAttribute:()=>attribute,removeAttribute:n=>{removed.push(n);attribute=null;},style:{getPropertyValue:k=>values.get(k)||'',getPropertyPriority:()=>'',setProperty:(k,v)=>{values.set(k,v);attribute='styled';},removeProperty:k=>{values.delete(k);attribute=values.size?'styled':'';},get length(){return values.size;}}};
  const unlock=lockBodyScroll(body,{scrollY:123,scrollTo:()=>{}});unlock();assert.equal(removed.length,initial===null?1:0);assert.equal(values.get('color'),initial?'red':undefined);
 }
});
test('v3 panel decoration is opt-in and default panel DOM stays unchanged',()=>{
 assert.equal(panel(),panel({mobileLayout:'fullscreen'}));assert.doesNotMatch(panel(),/fy-handle|fy-backdrop/);assert.match(panel({mobileLayout:'panel'}),/class="fy-handle" aria-hidden="true"/);
 const {WIDGET_STYLES}=load('components/ai-chat/styles.ts');const postcss=require('postcss');const css=postcss.parse(WIDGET_STYLES);let mobilePanel;
 css.walkRules(rule=>{if(rule.selector==='[data-ai-chat-widget][data-mobile-layout=panel] .fy-panel')mobilePanel=rule;});
 assert.equal(mobilePanel.parent.params,'(max-width:767px)');assert.deepEqual(mobilePanel.nodes.filter(n=>n.prop==='height').map(n=>n.value),['85vh','85dvh']);assert.equal(mobilePanel.nodes.find(n=>n.prop==='max-height').value,'100%');
});
test('v3 body unlock preserves unrelated inline styling added while open',()=>{
 const {lockBodyScroll}=load('components/ai-chat/viewModel.ts');const values=new Map();let attribute=null;
 const body={getAttribute:()=>attribute,removeAttribute:()=>{attribute=null;},style:{getPropertyValue:k=>values.get(k)||'',getPropertyPriority:()=>'',setProperty:(k,v)=>{values.set(k,v);attribute='styled';},removeProperty:k=>{values.delete(k);attribute=values.size?'styled':'';}}};
 const unlock=lockBodyScroll(body,{scrollY:0,scrollTo:()=>{}});body.style.setProperty('color','red');unlock();assert.equal(values.get('color'),'red');assert.equal(attribute,'styled');
});
test('v3 summary reuses a tool-recommended vehicle only for the same date, route and party',()=>{
 const {latestSummary}=load('components/ai-chat/viewModel.ts');
 const message=summaryMessage(summaryText);
 const prior=quote({pickup:'台北',destination:'九份',date:'2099-12-04',passenger_count:4});
 const summary=latestSummary([prior,message]);assert.equal(summary.vehicle,'九人座');assert.match(panel({messages:[prior,message],summary}),/<dt>建議車型<\/dt><dd>九人座<\/dd>/);
 for(const patch of [{date:'2099-12-05'},{pickup:'桃園'},{destination:'日月潭'},{passenger_count:5}]){
  const changed=structuredClone(prior);Object.assign(changed.parts[0].input,patch);assert.equal(latestSummary([changed,message]).vehicle,undefined);
 }
});
