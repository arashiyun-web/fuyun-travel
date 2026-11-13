import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const Module = require('node:module');
const ts = require('typescript');
const { mock, load } = require('../test-support/step2-load-ts.cjs');
let path = '/en';
mock('next/navigation', { usePathname: () => path });
Module._extensions['.tsx'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
};
const React = require('react');
const { renderToString } = require('react-dom/server');
test('widget SSR preserves raw scoped CSS for hydration and renders all three initial locales', () => {
  const Widget = load('components/AIChatWidget.tsx').default;
  for (const [pathname, label] of [['/en','AI travel concierge'],['/zh-cn','AI 旅遊管家'],['/','AI 旅遊管家']]) {
    path = pathname;
    const html = renderToString(React.createElement(Widget));
    assert.ok(html.includes(label), pathname);
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
    assert.ok(css.includes('.fy-body>*'), 'CSS selector must survive SSR without escaped text causing hydration replacement');
    assert.doesNotMatch(css, /&gt;|&lt;|&quot;|&amp;/);
    assert.match(html, /data-ai-chat-widget/);
  }
});
