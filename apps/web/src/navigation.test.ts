import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Shell from './App';

function renderRoute(route: string): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [route] }, createElement(Shell))
  );
}

test('homepage preserves official branding and separates discovery from owner registration', () => {
  const html = renderRoute('/');
  assert.match(html, /orqeli-brand\.png/);
  assert.match(html, /href="\/discover\?city=Kitwe"/);
  assert.match(html, /href="\/register\?role=BUSINESS_OWNER"/);
  assert.match(html, /Online booking is coming soon/);
  assert.doesNotMatch(html, /Book instantly/);
  assert.equal((html.match(/>Sign in<\/a>/g) ?? []).length, 1);
});

test('discovery retains supported cities and begins in an honest loading state', () => {
  for (const city of ['Kitwe', 'Ndola']) {
    const html = renderRoute(`/discover?city=${city}`);
    assert.match(html, new RegExp(`Explore ${city}`));
    assert.match(html, /Loading businesses in/);
  }
  assert.match(renderRoute('/discover?city=Unknown'), /Choose a supported city/);
});

test('initial render defers motion and provides accessible navigation landmarks', () => {
  const html = renderRoute('/');
  assert.doesNotMatch(html, /<video/);
  assert.match(html, /href="#main-content"/);
  assert.match(html, /aria-controls="main-navigation"/);
  assert.match(html, /aria-expanded="false"/);
});

test('protected routes retain the session-loading guard', () => {
  for (const route of ['/register?role=BUSINESS_OWNER', '/account', '/business', '/admin']) {
    const html = renderRoute(route);
    assert.match(html, /<h1>(Checking|Loading)[^<]*</);
  }
});
