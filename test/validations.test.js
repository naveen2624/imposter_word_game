import test from 'node:test';
import assert from 'node:assert';
import { validateConfig } from '../lib/validations.js';
const ok = { maxPlayers: 5, imposterCount: 1, totalRounds: 2, turnTimeLimit: 30, wordCategory: 'Fruits' };
test('valid config passes', () => assert.deepEqual(validateConfig(ok), []));
test('imposters must be fewer than players', () => assert.ok(validateConfig({ ...ok, maxPlayers: 3, imposterCount: 3 }).length));
test('bad timer rejected', () => assert.ok(validateConfig({ ...ok, turnTimeLimit: 20 }).length));
