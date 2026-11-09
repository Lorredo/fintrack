import { describe, expect, it } from '@jest/globals';

import { parseReceipt, receiptDescription } from './parseReceipt';

// Line arrays shaped like on-device OCR output: one entry per text line, with
// the quirks OCR adds (₱ read as "P", labels and values on separate lines).

describe('parseReceipt', () => {
  it('reads a GCash send money receipt', () => {
    const receipt = parseReceipt([
      'GCash',
      'Sent via GCash',
      'Juan Dela Cruz',
      '+63 917 *** 1234',
      'Amount',
      '1,500.00',
      'Total Amount Sent',
      'P1,500.00',
      'Ref No. 1012 345 678901',
      'Nov 9, 2026 3:40 PM',
    ]);
    expect(receipt.amount).toBe(1500);
    expect(receipt.date).toBe('2026-11-09');
    expect(receipt.reference).toBe('1012 345 678901');
    expect(receipt.source).toBe('gcash');
    expect(receipt.type).toBe('expense');
  });

  it('reads a GCash bills payment and suggests a category', () => {
    const receipt = parseReceipt([
      'Paid to',
      'MERALCO',
      'Amount Paid',
      '₱2,345.60',
      'Convenience Fee ₱15.00',
      'Reference No.: BP2026110912345',
      '09 Nov 2026 10:02 AM',
      'GCash',
    ]);
    expect(receipt.amount).toBe(2345.6);
    expect(receipt.merchant).toBe('MERALCO');
    expect(receipt.category).toBe('Bills & Utilities');
    expect(receipt.date).toBe('2026-11-09');
    expect(receiptDescription(receipt)).toBe('MERALCO · Ref BP2026110912345');
  });

  it('reads a Maya send money receipt', () => {
    const receipt = parseReceipt([
      'maya',
      'You sent PHP 250.00',
      'Sent to: Maria Santos',
      'Available balance PHP 3,120.55',
      'Date 11/08/2026',
      'Reference number 7A3F9C21B0',
    ]);
    expect(receipt.amount).toBe(250);
    expect(receipt.merchant).toBe('Maria Santos');
    expect(receipt.date).toBe('2026-11-08');
    expect(receipt.source).toBe('maya');
    expect(receipt.reference).toBe('7A3F9C21B0');
  });

  it('reads a bank transfer', () => {
    const receipt = parseReceipt([
      'InstaPay Transfer Successful',
      'Transfer to',
      'BPI •••• 4821',
      'Amount ₱5,000.00',
      'Transfer fee ₱15.00',
      '2026-11-07 08:15',
    ]);
    expect(receipt.amount).toBe(5000);
    expect(receipt.source).toBe('bank');
    expect(receipt.date).toBe('2026-11-07');
  });

  it('marks money received as income', () => {
    const receipt = parseReceipt(['You received ₱800.00', 'Received from', 'Ana Reyes', 'Nov 6, 2026']);
    expect(receipt.type).toBe('income');
    expect(receipt.amount).toBe(800);
    expect(receipt.merchant).toBe('Ana Reyes');
  });

  it('falls back to the largest amount and ignores balances', () => {
    const receipt = parseReceipt(['Order #1234', 'Item A P120.00', 'Item B P380.50', 'P500.50', 'Balance P9,999.00']);
    expect(receipt.amount).toBe(500.5);
  });

  it('copes with text that is not a receipt', () => {
    const receipt = parseReceipt(['Hello there', 'This is a photo of a cat', '']);
    expect(receipt.amount).toBeUndefined();
    expect(receipt.date).toBeUndefined();
    expect(receipt.merchant).toBeUndefined();
    expect(receipt.type).toBe('expense');
  });

  it('rejects impossible dates', () => {
    expect(parseReceipt(['Feb 30, 2026']).date).toBeUndefined();
    expect(parseReceipt(['13/45/2026']).date).toBeUndefined();
  });
});
