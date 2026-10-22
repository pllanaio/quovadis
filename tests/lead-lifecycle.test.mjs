import assert from 'node:assert/strict';
import test from 'node:test';
import {leadLifecycle} from '../lib/leads.ts';

const now = Date.parse('2026-10-22T10:00:00Z');

test('a new lead remains in the charts until the ten-day boundary', () => {
  const before = leadLifecycle({score: 91, created_at: '2026-10-12T10:00:00.001Z'}, now);
  const atBoundary = leadLifecycle({score: 91, created_at: '2026-10-12T10:00:00.000Z'}, now);
  assert.equal(before.chart_eligible, true);
  assert.equal(atBoundary.chart_eligible, false);
  assert.equal(atBoundary.is_stale, true);
  assert.equal(atBoundary.ranking_score, 23);
});

test('a new discovery timestamp does not revive an old company', () => {
  const state = leadLifecycle({score: 95, created_at: '2026-09-01T10:00:00Z', detected_at: '2026-10-22T09:00:00Z'}, now);
  assert.equal(state.is_stale, true);
  assert.equal(state.freshness_at, '2026-09-01T10:00:00.000Z');
});

test('a nonempty note revives the lead and starts a fresh ten-day period', () => {
  const state = leadLifecycle({score: 85, created_at: '2026-09-01T10:00:00Z', last_note_at: '2026-10-21T09:00:00Z'}, now);
  assert.equal(state.chart_eligible, true);
  assert.equal(state.ranking_score, 85);
  assert.equal(state.stale_at, '2026-10-31T09:00:00.000Z');
});

test('the score color reflects fit while ranking reflects age', () => {
  const state = leadLifecycle({score: 96, created_at: '2026-09-01T10:00:00Z'}, now);
  assert.equal(state.score_color, 'green');
  assert.equal(state.ranking_score, 24);
  assert.equal(leadLifecycle({score: 65, created_at: new Date(now)}, now).score_color, 'amber');
  assert.equal(leadLifecycle({score: 40, created_at: new Date(now)}, now).score_color, 'red');
});
