import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_API_PORT, resolveApiProxyTarget } from './apiProxy.js';

test('the dev proxy follows the PORT the API reads from .env', () => {
  // Regression guard: this used to be hard-coded to 4000 while the API ran on the
  // PORT from .env (3000 in the reported setup), so every browser request failed
  // with a Vite 500 and the UI showed "The request could not be completed.".
  assert.equal(
    resolveApiProxyTarget({ fileValues: { PORT: '3000' }, processEnv: {} }),
    'http://127.0.0.1:3000'
  );
  assert.equal(
    resolveApiProxyTarget({ fileValues: { PORT: '4000' }, processEnv: {} }),
    'http://127.0.0.1:4000'
  );
});

test('the dev proxy defaults to port 4000 when no PORT is configured', () => {
  assert.equal(resolveApiProxyTarget({ fileValues: {}, processEnv: {} }), `http://127.0.0.1:${DEFAULT_API_PORT}`);
  assert.equal(
    resolveApiProxyTarget({ fileValues: { PORT: '   ' }, processEnv: {} }),
    `http://127.0.0.1:${DEFAULT_API_PORT}`
  );
});

test('real environment variables win over .env values', () => {
  assert.equal(
    resolveApiProxyTarget({ fileValues: { PORT: '3000' }, processEnv: { PORT: '5001' } }),
    'http://127.0.0.1:5001'
  );
});

test('VITE_API_PROXY_TARGET overrides the derived target', () => {
  assert.equal(
    resolveApiProxyTarget({
      fileValues: { PORT: '3000', VITE_API_PROXY_TARGET: 'http://api.internal:8080' },
      processEnv: {}
    }),
    'http://api.internal:8080'
  );
});

test('the proxy never derives its port from NODE_ENV or unrelated values', () => {
  assert.equal(
    resolveApiProxyTarget({ fileValues: { NODE_ENV: 'development' }, processEnv: {} }),
    `http://127.0.0.1:${DEFAULT_API_PORT}`
  );
  assert.equal(
    resolveApiProxyTarget({ fileValues: { PORT: '3000', NODE_ENV: 'production' }, processEnv: {} }),
    'http://127.0.0.1:3000'
  );
});
