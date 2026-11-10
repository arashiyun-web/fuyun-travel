const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support/step2-load-ts.cjs');
let editor;
try { editor = load('lib/content-factory/editor.ts'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
const result = {
  geo_summary: 'old summary', seo_article: { h1: 'title', body_markdown: 'old web', faq: [{q:'question',a:'answer'}] },
  facebook: { body: 'old FB', info_table: { 行程名稱:'trip' } }, instagram: {caption:'old IG',hashtags:['#fixture']}, x: {body:'old X'},
  line_oa:'old LINE', edm:{subject:'subject',body:'old EDM'}, extras:{gmb_short:'old short',ai_qa_block:[],ab_test:{fb:[],ig:[]}}, json_ld:'{}',
};
test('editor uses platform body fields and saves edited output while preserving structured metadata', () => {
  assert.ok(editor, 'editor serializer must exist');
  assert.equal(editor.editableChannelText(result,'facebook'),'old FB');
  assert.equal(editor.editableChannelText(result,'instagram'),'old IG');
  assert.equal(editor.editableChannelText(result,'seo_article'),'old web');
  const updated=editor.applyChannelEdits(result,{geo_summary:'new summary',seo_article:'new web',facebook:'new FB',instagram:'new IG',x:'new X',line_oa:'new LINE',edm:'new EDM',extras:'new short',json_ld:'{"@type":"TouristTrip"}'});
  const saved=JSON.parse(JSON.stringify({output:updated})).output;
  assert.equal(saved.geo_summary,'new summary'); assert.equal(saved.seo_article.body_markdown,'new web');
  assert.equal(saved.facebook.body,'new FB'); assert.equal(saved.instagram.caption,'new IG'); assert.equal(saved.x.body,'new X');
  assert.equal(saved.line_oa,'new LINE'); assert.equal(saved.edm.body,'new EDM'); assert.equal(saved.extras.gmb_short,'new short');
  assert.equal(saved.json_ld,'{"@type":"TouristTrip"}');
  assert.deepEqual(saved.seo_article.faq,[{q:'question',a:'answer'}]);
  assert.deepEqual(saved.facebook.info_table,{行程名稱:'trip'}); assert.deepEqual(saved.instagram.hashtags,['#fixture']);
  assert.equal(saved.edm.subject,'subject'); assert.equal(result.facebook.body,'old FB');
});
test('saving unchanged output preserves generated platform fields', () => {
  assert.ok(editor, 'editor serializer must exist');
  assert.deepEqual(editor.applyChannelEdits(result,{}),result);
});
