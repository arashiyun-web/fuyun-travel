import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test';
import { fixture, feature, now } from './fixtures.mjs';
const request=()=>new Request('http://localhost/api/chat',{method:'POST',body:JSON.stringify({id:'model-config',messages:[{id:'u',role:'user',parts:[{type:'text',text:'Hello'}]}]})});
test('chat requires both non-empty server key and configured model without any fallback',async()=>{
  const { createChatHandler }=feature('lib/chat/handler.ts');
  for(const [key,name] of [[undefined,'approved-model'],['offline-key',undefined],['offline-key',''],['offline-key','  ']]) {
    let calls=0;
    const POST=createChatHandler({apiKey:()=>key,modelName:()=>name,model:()=>{calls++;},store:{admit:async()=>{calls++;}}});
    const response=await POST(request());
    assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.doesNotMatch(await response.text(),/OPENAI|API_KEY|MODEL|offline-key/);
    assert.equal(calls,0);
  }
});
test('chat passes the configured model name to provider and preserves actual response identity',async()=>{
  const f=await fixture();
  try {
    const { createChatHandler }=feature('lib/chat/handler.ts');let selected;
    const model=new MockLanguageModelV4({doStream:{stream:convertArrayToReadableStream([
      {type:'stream-start',warnings:[]},{type:'response-metadata',modelId:'actual-response-model-v2'},
      {type:'text-start',id:'t'},{type:'text-delta',id:'t',delta:'Hello!'},{type:'text-end',id:'t'},
      {type:'finish',usage:{inputTokens:{total:1},outputTokens:{total:1}},finishReason:{unified:'stop'}},
    ])}});
    const POST=createChatHandler({apiKey:()=> 'offline-key',modelName:()=> 'approved-model-v2',model:name=>{selected=name;return model;},store:f.store,aiApi:f.api,notify:async()=>{},now:()=>now});
    const response=await POST(request());assert.equal(response.status,200);await response.text();
    assert.equal(selected,'approved-model-v2');assert.equal(model.doStreamCalls.length,1);
  } finally {await f.pg.close();}
});
