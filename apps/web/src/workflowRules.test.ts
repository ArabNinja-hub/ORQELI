import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatCompletenessRatio,
  formatPackStatus,
  validateDraftMarkInput
} from './workflowRules.js';

test('draft mark validation enforces whole numbers within subject maxMark and null for non-present statuses', () => {
  assert.deepEqual(validateDraftMarkInput('PRESENT', '84', 100), { valid: true, score: 84 });
  assert.deepEqual(validateDraftMarkInput('PRESENT', '0', 100), { valid: true, score: 0 });
  assert.equal(validateDraftMarkInput('PRESENT', '', 100).valid, false);
  assert.equal(validateDraftMarkInput('PRESENT', '74.5', 100).valid, false);
  assert.equal(validateDraftMarkInput('PRESENT', '101', 100).valid, false);
  assert.deepEqual(validateDraftMarkInput('ABSENT', '', 100), { valid: true, score: null });
  assert.equal(validateDraftMarkInput('ABSENT', '50', 100).valid, false);
});

test('completeness formatting distinguishes complete packs from missing entries and zero-allocation classes', () => {
  assert.deepEqual(formatCompletenessRatio(0, 0), {
    percent: 0,
    label: 'No subject allocations configured'
  });
  assert.deepEqual(formatCompletenessRatio(11, 12), {
    percent: 92,
    label: '11 / 12 recorded (1 missing)'
  });
  assert.deepEqual(formatCompletenessRatio(12, 12), {
    percent: 100,
    label: '12 / 12 entries complete'
  });
});

test('approved pack status summary explicitly notes unpublished results remain hidden from parents', () => {
  const approved = formatPackStatus('APPROVED');
  assert.equal(approved.tone, 'approved');
  assert.match(approved.summary, /hidden from parents until published/i);
});
