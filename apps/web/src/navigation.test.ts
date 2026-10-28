import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

function renderRoute(route: string): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [route] }, createElement(App))
  );
}

test('landing page presents ORQELI Education identity, honest research stage, and zero marketplace remnants', () => {
  const html = renderRoute('/');

  assert.match(html, /ORQELI/);
  assert.match(html, /EDUCATION/);
  assert.match(html, /schools in Zambia/i);
  assert.match(html, /100% synthetic demonstration data/i);
  assert.match(html, /not endorsed by or affiliated with the Ministry of Education or ECZ/i);

  for (const forbiddenLegacyPhrase of [
    'List your business',
    'Explore businesses',
    'Online booking is coming soon',
    'Connecting Business',
    'barbershop',
    'salon',
    'orqeli-brand.png'
  ]) {
    assert.equal(
      html.toLowerCase().includes(forbiddenLegacyPhrase.toLowerCase()),
      false,
      `Found leftover marketplace text: ${forbiddenLegacyPhrase}`
    );
  }
});

test('landing page exposes accessible skip link, navigation landmarks, and workflow sections', () => {
  const html = renderRoute('/');

  assert.match(html, /href="#main-content"/);
  assert.match(html, /aria-controls="main-navigation"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /id="problems"/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /id="access"/);
});

test('protected workspace and report-card routes guard access behind session verification', () => {
  for (const route of [
    '/workspace',
    '/workspace/schools/sch_1/packs/pck_1/report-card/lrn_1',
    '/workspace/schools/sch_1/guardian/report-card/pck_1/lrn_1'
  ]) {
    const html = renderRoute(route);
    assert.match(html, /Checking session…/);
  }
});

test('unknown routes render a clear 404 recovery view', () => {
  const html = renderRoute('/non-existent-route');
  assert.match(html, /404 · PAGE NOT FOUND/);
});
