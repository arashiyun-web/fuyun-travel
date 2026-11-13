import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const Module = require('node:module');
const { load, mock } = require('../test-support/step2-load-ts.cjs');
mock('next/navigation', { usePathname: () => '/en' });
Module._extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename,'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX } }).outputText, filename);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const postcss = require('postcss');
function feature(file) { assert.ok(existsSync(process.cwd() + '/' + file), file + ' must exist'); return load(file); }
const actions = Object.fromEntries(['close','toggleMenu','locale','input','submit','stop','retry','confirm','chip'].map(key => [key,()=>{}]));
function panel(patch={}) {
  const { ChatPanel } = feature('components/ai-chat/ChatPanel.tsx');
  const props = { locale:'zh-TW',messages:[],busy:false,input:'',issue:null,menuOpen:false,summary:null,summaryRead:false,
    contacts:feature('lib/chatContacts.ts').chatContacts,actions,
    historyRef:React.createRef(),inputRef:React.createRef(),closeRef:React.createRef(),summaryStartRef:React.createRef(),summaryEndRef:React.createRef(), ...patch };
  return renderToStaticMarkup(React.createElement(ChatPanel,props));
}
const summaryText = '訂單摘要\n聯絡人：王先生\n聯絡方式：line offline_id\n上車：台北車站\n下車：九份老街\n日期時間：2099-12-04 09:00\n人數：4 人\n行李：6 件\n請回覆「我確認」。';
const message = (text,id='a') => ({id,role:'assistant',parts:[{type:'text',text}]});
test('v2 launcher has real readable approved label and raw scoped style text',()=>{
  const Widget=load('components/AIChatWidget.tsx').default;
  const html=renderToStaticMarkup(React.createElement(Widget));
  assert.match(html,/>AI travel concierge</);
  assert.match(html,/aria-label="Open AI travel concierge"/);
  assert.doesNotMatch(html,/<style>[\s\S]*?&gt;/);
  assert.doesNotMatch(html,/富運/);
});
test('v2 contact row exposes only the usable official LINE account, including empty configuration',()=>{
  const { resolveChatContacts }=feature('lib/chatContacts.ts');
  for(const contacts of [resolveChatContacts({}),resolveChatContacts({line:''}),resolveChatContacts({line:'https://lin.ee/old',whatsapp:'+886912345678',wechat:'offline_id'})]) {
    const html=panel({contacts});
    const nav=html.match(/<nav[\s\S]*?<\/nav>/)[0];
    assert.equal((nav.match(/data-contact=/g)||[]).length,1);
    assert.equal((nav.match(/<a\b/g)||[]).length,1);
    assert.match(nav,/data-contact="line"/);
    assert.match(nav,/href="https:\/\/line\.me\/R\/ti\/p\/@954fyicw"/);
    assert.doesNotMatch(nav,/<button|aria-disabled|fy-pending|設定中|WhatsApp|微信|電話|tel:|wa\.me|wechat/i);
  }
});
test('v2 every issue and tool error compact contact row exposes only the official LINE link',()=>{
  const cases=['paused','limited','tooLong','network'].map(kind=>({issue:{kind}}));
  cases.push({messages:[{id:'error',role:'assistant',parts:[{type:'tool-get_quote',output:{kind:'error',status:503}}]}]});
  for(const locale of ['zh-TW','zh-CN','en']) for(const state of cases) {
    const html=panel({locale,...state});
    const navs=Array.from(html.matchAll(/<nav[^>]*class="(fy-contacts|fy-act)"[\s\S]*?<\/nav>/g));
    assert.equal(navs.length,2);
    assert.deepEqual(navs.map(m=>m[1]),['fy-contacts','fy-act']);
    for(const [nav] of navs) {
      assert.equal((nav.match(/data-contact=/g)||[]).length,1);
      assert.equal((nav.match(/<a\b/g)||[]).length,1);
      assert.match(nav,/data-contact="line"/);
      assert.match(nav,/href="https:\/\/line\.me\/R\/ti\/p\/@954fyicw"/);
      assert.doesNotMatch(nav,/<button|aria-disabled|fy-pending|設定中|设置中|being configured|WhatsApp|微信|WeChat|電話|电话|Call|tel:|wa\.me/i);
    }
    const alert=html.match(/<section class="fy-alert[\s\S]*?<\/section>/)[0];
    assert.match(alert,/LINE/);
    assert.doesNotMatch(alert,/WhatsApp|微信|WeChat|電話|电话|Call|tel:|wa\.me/i);
  }
});
test('v2 language menu exposes exactly the approved three option names',()=>{
  const html=panel({menuOpen:true});
  const options=Array.from(html.matchAll(/role="option"[^>]*aria-label="([^"]+)"/g),m=>m[1]);
  assert.deepEqual(options,['繁體中文','简体中文','English']);
});
test('v2 paused, limited, long and network states have distinct actionable copy',()=>{
  for(const [issue,title] of [[{kind:'paused'},'AI 客服暫停服務中'],[{kind:'limited',retryAfter:73},'詢問太頻繁了'],[{kind:'tooLong'},'訊息太長'],[{kind:'network'},'網路連線中斷']]) {
    const html=panel({issue,input:issue.kind==='tooLong'?'字'.repeat(1001):''});
    assert.ok(html.includes(title));
    assert.match(html,/role="alert"/);
    if(issue.kind==='limited') assert.match(html,/73 秒/);
    if(issue.kind==='tooLong') { assert.match(html,/fy-over/); assert.match(html,/1001\/1000/); }
    if(issue.kind==='network') assert.match(html,/重新傳送/);
  }
});
test('v2 fixed quote and booking notices are rendered verbatim from tool outputs',()=>{
  const notice='SERVER_NOTICE_此為伺服器原文，不由前端或模型改寫。';
  const quote={id:'q',role:'assistant',parts:[{type:'tool-get_quote',toolCallId:'q',state:'output-available',input:{pickup:'台北',destination:'九份',date:'2099-12-04',passenger_count:4},output:{kind:'quote',quote:{price_available:true,low:7000,high:8500,vehicle:'九人座'},notice}}]};
  const booking={id:'b',role:'assistant',parts:[{type:'tool-create_booking',toolCallId:'b',state:'output-available',input:{},output:{kind:'booking',booking_number:'FY-TEST-20991201-ABCD',status:'pending_review',notice}}]};
  const html=panel({messages:[quote,booking]});
  assert.equal(html.split(notice).length-1,2);
  assert.match(html,/7,000/);assert.match(html,/8,500/);
  assert.match(html,/FY-TEST-20991201-ABCD/);
  assert.doesNotMatch(html,/已成交|已保留|富運/);
  const staff=structuredClone(quote);staff.parts[0].output.quote.price_available=false;
  assert.match(panel({messages:[staff]}),/將由專人報價/);
});
for(const {name,quote,want} of [
  {name:'equal endpoints require staff pricing',quote:{price_available:true,low:7000,high:7000},want:'專人報價'},
  {name:'reversed endpoints require staff pricing',quote:{price_available:true,low:9000,high:8500},want:'專人報價'},
  {name:'equal endpoints require staff pricing even when unavailable',quote:{price_available:false,low:7000,high:7000},want:'專人報價'},
  {name:'reversed endpoints require staff pricing even when unavailable',quote:{price_available:false,low:9000,high:8500},want:'專人報價'},
  {name:'missing low keeps staff fallback',quote:{price_available:true,high:8500},want:'將由專人報價'},
  {name:'missing high keeps staff fallback',quote:{price_available:true,low:7000},want:'將由專人報價'},
  {name:'null low keeps staff fallback',quote:{price_available:true,low:null,high:8500},want:'將由專人報價'},
  {name:'null high keeps staff fallback',quote:{price_available:true,low:7000,high:null},want:'將由專人報價'},
  {name:'unavailable pricing keeps staff fallback',quote:{price_available:false,low:7000,high:8500},want:'將由專人報價'},
  {name:'increasing endpoints retain numeric range',quote:{price_available:true,low:7000,high:8500},want:'NT$ 7,000 – 8,500'},
]) test('v2 quote: '+name,()=>{
  const html=panel({messages:[{id:'q',role:'assistant',parts:[{type:'tool-get_quote',input:{},output:{kind:'quote',quote,notice:'SERVER_NOTICE'}}]}]});
  const price=html.match(/<div class="fy-price[^"]*">([^<]*)<\/div>/)[1];
  assert.equal(price,want);
  assert.doesNotMatch(price,/7,000 – 7,000|9,000 – 8,500/);
});
test('v2 confirmation stays disabled until a complete visible summary has been reviewed',()=>{
  const { latestSummary }=feature('components/ai-chat/viewModel.ts');
  assert.equal(latestSummary([message('請問去哪裡？')]),null);
  assert.equal(latestSummary([message('訂單摘要：台北到九份')]),null);
  const summary=latestSummary([message(summaryText)]);
  assert.ok(summary);
  assert.match(panel({messages:[message(summaryText)],summary,summaryRead:false}),/class="fy-confirm[^"]*"[^>]*disabled/);
  assert.doesNotMatch(panel({messages:[message(summaryText)],summary,summaryRead:true}),/class="fy-confirm[^"]*"[^>]*disabled/);
});
test('v2 busy state renders typing dots and a stop control; long text remains escaped',()=>{
  const html=panel({busy:true,messages:[message('https://example.invalid/'+ 'LongWord'.repeat(90)+'\n<img src=x onerror=bad>')]});
  assert.match(html,/fy-typing-dots/);assert.match(html,/aria-label="停止回覆"/);
  assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
});
test('v2 CSS has no unscoped selectors, external fonts or image imports and matches critical design tokens',()=>{
  const { WIDGET_STYLES }=feature('components/ai-chat/styles.ts');
  const css=postcss.parse(WIDGET_STYLES);
  css.walkRules(rule=>{ for(const selector of rule.selectors) assert.ok(selector.trim().startsWith('[data-ai-chat-widget]'),selector); });
  css.walkAtRules(rule=>assert.ok(['media','supports'].includes(rule.name),rule.name));
  assert.doesNotMatch(WIDGET_STYLES,/@import|@font-face|url\(/);
  for(const value of ['--fy-panel-w:392px','--fy-panel-h:720px','--fy-mobile-launcher-bottom:144px','--fy-z-drawer:70','--fy-hit:44px','--fy-fs-disclaimer:13px'])assert.ok(WIDGET_STYLES.includes(value),value);
  assert.match(WIDGET_STYLES,/prefers-reduced-motion/);
  assert.match(WIDGET_STYLES,/100dvh/);
  assert.match(WIDGET_STYLES,/--fy-focus-ring/);
  assert.match(WIDGET_STYLES,/\.fy-meta span:first-child\{[^}]*font-size:var\(--fy-fs-disclaimer\)/);
  assert.match(WIDGET_STYLES,/@media\(max-width:767px\)\{\[data-ai-chat-widget\]\{[^}]*--fy-fs-disclaimer:14px/);
});
test('v2 body lock restores original inline values and viewport offsets keep keyboard space clear',()=>{
  const { lockBodyScroll, viewportVariables }=feature('components/ai-chat/viewModel.ts');
  const values=new Map([['overflow',['auto','important']],['color',['red','']]]);
  const before=structuredClone(Array.from(values.entries()));
  const style={getPropertyValue:k=>values.get(k)?.[0]||'',getPropertyPriority:k=>values.get(k)?.[1]||'',setProperty:(k,v,p='')=>values.set(k,[v,p]),removeProperty:k=>values.delete(k)};
  let scroll;
  const unlock=lockBodyScroll({style},{scrollY:125,scrollTo:(x,y)=>{scroll=[x,y];}});
  assert.equal(values.get('position')[0],'fixed');
  assert.equal(values.get('top')[0],'-125px');
  unlock();assert.deepEqual(Array.from(values.entries()),before);assert.deepEqual(scroll,[0,125]);
  assert.deepEqual(viewportVariables({height:544,offsetTop:12}),{'--fy-viewport-height':'544px','--fy-viewport-top':'12px'});
});

test('all 44 approved contrast pairs meet their text or non-text threshold',()=>{
 const pairs=JSON.parse(readFileSync(new URL('./fixtures/v2-contrast.json',import.meta.url)));
 assert.equal(pairs.length,44);
 const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
 for(const pair of pairs){const a=luminance(pair.fg),b=luminance(pair.bg);assert.ok((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=pair.required,pair.name);}
});

test('self-contained v2 visual fixtures cover all notice locales and pending booking states',()=>{
 const states=JSON.parse(readFileSync(new URL('./fixtures/v2-ui-states.json',import.meta.url)));
 for(const locale of ['zh-TW','zh-CN','en']){const quote=states['quote-'+locale],booking=states['booking-'+locale];assert.ok(quote.output.notice.length>50);assert.ok(booking.output.notice.length>50);assert.equal(booking.output.status,'pending_review');assert.ok(panel({locale,messages:[{id:'q',role:'assistant',parts:[{type:'tool-get_quote',output:quote.output,input:quote.input}]}]}).includes(quote.output.notice));}
});

test('typing does not render an empty assistant bubble before the first streamed text',()=>{
 const html=panel({busy:true,messages:[{id:'pending',role:'assistant',parts:[{type:'text',text:''}]}]});
 assert.doesNotMatch(html,/<p class="fy-message fy-bot"><\/p>/);
 assert.equal((html.match(/class="fy-who"/g)||[]).length,1);
});
