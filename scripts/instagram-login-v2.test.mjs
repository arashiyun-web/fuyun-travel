import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstagramLoginClientV2, instagramLoginReadinessV2, InstagramV2Error } from '../lib/social/instagram-login-v2.ts';

const config = { accountId: '123456', accessToken: 'test-secret-not-real', apiVersion: 'v26.0', mediaOrigins: ['https://images.example.com'] };
const input = { caption: '浮雲測試，未公開發佈', imageUrl: 'https://images.example.com/photo.jpg', mimeType: 'image/jpeg' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('missing Instagram credentials never fall back to Facebook; reports no secret values', () => {
  const result = instagramLoginReadinessV2({ FACEBOOK_ACCESS_TOKEN: 'private-fb-value' });
  assert.equal(result.configuration, 'BLOCKED_AUTH');
  assert.equal(result.facebookPageRequired, false);
  assert.ok(result.missing.includes('INSTAGRAM_LOGIN_ACCESS_TOKEN'));
  assert.ok(!JSON.stringify(result).includes('private-fb-value'));
});

test('configuration present is not proof of OAuth, activation, or publishing', () => {
  const result = instagramLoginReadinessV2({ INSTAGRAM_LOGIN_ACCOUNT_ID: config.accountId, INSTAGRAM_LOGIN_ACCESS_TOKEN: config.accessToken, INSTAGRAM_LOGIN_API_VERSION: config.apiVersion, INSTAGRAM_LOGIN_MEDIA_ORIGIN: config.mediaOrigins[0] });
  assert.equal(result.configuration, 'PASS');
  for (const key of ['authorization', 'activation', 'publishing']) assert.equal(result[key], 'NOT_TESTED');
  assert.ok(!JSON.stringify(result).includes(config.accessToken));
});

test('only Instagram host is used; token stays in Authorization, not URL or body', async () => {
  const calls = [];
  const client = createInstagramLoginClientV2(config, async (url, options) => { calls.push([url, options]); return json({ id: '789' }); });
  assert.deepEqual(await client.createImageContainer(input), { containerId: '789', status: 'container_created' });
  const result = await client.publishContainer('789');
  assert.equal(result.status, 'submitted_pending_verification');
  assert.equal(calls.length, 2);
  for (const [url, options] of calls) {
    assert.ok(url.startsWith('https://graph.instagram.com/v26.0/'));
    assert.ok(!url.includes(config.accessToken));
    assert.ok(!options.body.includes(config.accessToken));
    assert.equal(options.headers.Authorization, `Bearer ${config.accessToken}`);
    assert.equal(options.redirect, 'error');
  }
});

test('multi-image carousel uses JPEG child containers and a separate carousel container', async () => {
  const calls = [];
  const responses = [{ id: '101' }, { id: '102' }, { id: '103' }];
  const client = createInstagramLoginClientV2(config, async (url, options) => {
    calls.push([url, options]);
    return json(responses[calls.length - 1]);
  });
  const first = await client.createImageContainer({ imageUrl: 'https://images.example.com/1.jpg', mimeType: 'image/jpeg', isCarouselItem: true });
  const second = await client.createImageContainer({ imageUrl: 'https://images.example.com/2.jpg', mimeType: 'image/jpeg', isCarouselItem: true });
  const carousel = await client.createCarouselContainer({ caption: input.caption, children: [first.containerId, second.containerId] });
  assert.equal(carousel.containerId, '103');
  assert.equal(JSON.parse(calls[0][1].body).is_carousel_item, true);
  assert.equal(JSON.parse(calls[1][1].body).is_carousel_item, true);
  assert.deepEqual(JSON.parse(calls[2][1].body), { media_type: 'CAROUSEL', children: '101,102', caption: input.caption });
});

test('non-public, unapproved-origin, non-JPEG and oversized content rejected before network', async () => {
  let calls = 0;
  const client = createInstagramLoginClientV2(config, async () => { calls++; return json({ id: '789' }); });
  for (const imageUrl of ['http://images.example.com/a.jpg', 'https://192.168.18.17/a.jpg', 'https://evil.example.com/a.jpg', 'https://name:pass@images.example.com/a.jpg']) {
    await assert.rejects(() => client.createImageContainer({ ...input, imageUrl }), { kind: 'input' });
  }
  await assert.rejects(() => client.createImageContainer({ ...input, mimeType: 'image/png' }), { kind: 'input' });
  await assert.rejects(() => client.createImageContainer({ ...input, caption: '字'.repeat(2201) }), { kind: 'input' });
  await assert.rejects(() => client.publishContainer('../me'), { kind: 'input' });
  assert.equal(calls, 0);
});

test('timeouts are ambiguous, sanitized, and never automatically retried', async () => {
  let calls = 0;
  const client = createInstagramLoginClientV2(config, async () => { calls++; throw new Error(`request failed: ${config.accessToken}`); });
  await assert.rejects(() => client.publishContainer('789'), (error) => {
    assert.ok(error instanceof InstagramV2Error);
    assert.equal(error.kind, 'unknown');
    assert.equal(error.mayHaveSucceeded, true);
    assert.equal(error.automaticRetryAllowed, false);
    assert.ok(!String(error).includes(config.accessToken));
    return true;
  });
  assert.equal(calls, 1);
});

test('HTTP 200 without valid ID, 5xx, 429 and malformed responses are not success', async () => {
  for (const response of [json({}), json({ id: '789' }, 500), json({ error: { message: config.accessToken } }, 429), new Response('not-json')]) {
    const client = createInstagramLoginClientV2(config, async () => response);
    await assert.rejects(() => client.publishContainer('789'), { kind: 'unknown', mayHaveSucceeded: true, automaticRetryAllowed: false });
  }
});

test('invalid/expired authorization never exposes the provider error text', async () => {
  const client = createInstagramLoginClientV2(config, async () => json({ error: { code: 190, message: config.accessToken } }, 400));
  await assert.rejects(() => client.publishContainer('789'), { kind: 'authorization', message: 'Instagram V2: authorization', automaticRetryAllowed: false });
});

test('container PUBLISHED does not itself verify a public post', async () => {
  const client = createInstagramLoginClientV2(config, async () => json({ status_code: 'PUBLISHED' }));
  const result = await client.getContainerStatus('789');
  assert.equal(result.status, 'PUBLISHED');
  assert.equal(result.verification, undefined);
});

test('verification requires matching ID, exact approved caption, image, and Instagram permalink', async () => {
  const data = { id: '999', caption: input.caption, media_type: 'IMAGE', permalink: 'https://www.instagram.com/p/testCode/' };
  const client = createInstagramLoginClientV2(config, async () => json(data));
  assert.equal((await client.verifyPublishedImage('999', input.caption)).verification, 'verified');
  for (const bad of [{ ...data, id: '998' }, { ...data, caption: 'different' }, { ...data, media_type: 'VIDEO' }, { ...data, permalink: 'https://evil.example.com/p/testCode/' }, { ...data, permalink: 'https://www.instagram.com/p/testCode/?token=hidden' }]) {
    const rejected = createInstagramLoginClientV2(config, async () => json(bad));
    await assert.rejects(() => rejected.verifyPublishedImage('999', input.caption), { kind: 'unknown' });
  }
});
