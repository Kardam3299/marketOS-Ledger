import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, setActiveCurrency, resetActiveCurrency } from './formatters.js';

test('uses the active currency when no override is provided', () => {
  setActiveCurrency('EUR');
  const formatted = formatCurrency(1234.5);
  assert.match(formatted, /1,234\.50/);
  resetActiveCurrency();
});

test('uses a provided currency override', () => {
  setActiveCurrency('USD');
  const formatted = formatCurrency(1234.5, 'GBP');
  assert.match(formatted, /£1,234\.50/);
  resetActiveCurrency();
});
