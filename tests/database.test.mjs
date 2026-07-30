import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initializeDatabase, closeDatabase } from '../electron/database.js';

test('creates and reads ledger records without native bindings', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
  process.env.LEDGER_DB_PATH = path.join(tempDir, 'ledger.db');

  const db = initializeDatabase();

  db.prepare(`
    INSERT INTO transactions (date, type, category, amount, payment_mode, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    '2026-07-27',
    'income',
    'Sales',
    1250,
    'Cash',
    'Test sale',
    '2026-07-27T00:00:00.000Z',
    '2026-07-27T00:00:00.000Z'
  );

  const settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
  assert.equal(settings.currency, 'USD');

  const rows = db.prepare('SELECT * FROM transactions WHERE 1=1 ORDER BY id ASC').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, 'Sales');

  closeDatabase();
});
