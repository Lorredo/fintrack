// Reads the text that on-device OCR found in a receipt screenshot and pulls out
// what the transaction form needs. It only ever fills the form: the user always
// checks the details before saving, so a wrong guess costs a tap, not data.

export type ReceiptSource = 'gcash' | 'maya' | 'bank';

export interface ParsedReceipt {
  amount?: number;
  /** YYYY-MM-DD */
  date?: string;
  merchant?: string;
  reference?: string;
  source?: ReceiptSource;
  type: 'expense' | 'income';
  /** A suggested category when the merchant is a well-known biller. */
  category?: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// ₱1,234.56 / PHP 1234.56 / P 1,234 / 1,234.56 PHP. OCR often reads ₱ as "P".
const CURRENCY_AMOUNT =
  /(?:₱|PHP|Php|php|(?<![A-Za-z])P)\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)|(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2})\s?(?:PHP|Php)/g;

// Lines whose amount is the transaction itself, best first.
const AMOUNT_KEYWORDS = [
  'total amount sent',
  'total amount paid',
  'amount paid',
  'total amount',
  'amount sent',
  'you sent',
  'you paid',
  'you received',
  'amount received',
  'amount',
  'total',
  'payment',
  'paid',
];

// Amounts on these lines are not the transaction.
const IGNORED_AMOUNT_LINES = /balance|fee|charge|limit|points|discount|cashback/i;

const MERCHANT_LABELS = /^(?:sent to|send to|paid to|pay to|transfer(?:red)? to|received from|recipient|merchant|biller|to|from)\b\s*:?\s*/i;

const PHONE_LIKE = /^(?:\+?63|0)?\s?9[\d*\s-]{6,}$|^[\d*\s+-]{7,}$/;

// Only the transaction form's built-in expense categories, so the pill exists.
const BILLER_CATEGORIES: [RegExp, string][] = [
  [/meralco|maynilad|manila water|veco|davao light|electric|water district/i, 'Bills & Utilities'],
  [/pldt|globe|smart|converge|dito|sky ?cable|tnt|tm\b/i, 'Bills & Utilities'],
  [/netflix|spotify|youtube|disney|viu|hbo/i, 'Entertainment'],
  [/grab|angkas|joyride|move ?it|lrt|mrt|beep/i, 'Transportation'],
  [/jollibee|mcdo|mcdonald|chowking|mang inasal|foodpanda|starbucks/i, 'Food & Drinks'],
];

function toNumber(raw: string): number | undefined {
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : undefined;
}

function amountsIn(line: string): number[] {
  const amounts: number[] = [];
  for (const match of line.matchAll(CURRENCY_AMOUNT)) {
    const value = toNumber(match[1] ?? match[2] ?? '');
    if (value !== undefined) amounts.push(value);
  }
  return amounts;
}

/** A bare number, for an amount on the line after its label ("Amount" / "1,500.00"). */
function bareAmount(line: string): number | undefined {
  const match = line.trim().match(/^(?:₱|PHP|P)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)$/i);
  return match ? toNumber(match[1]) : undefined;
}

function findAmount(lines: string[]): number | undefined {
  for (const keyword of AMOUNT_KEYWORDS) {
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (!lower.includes(keyword) || IGNORED_AMOUNT_LINES.test(lower)) continue;
      const onLine = amountsIn(lines[i]);
      if (onLine.length > 0) return onLine[0];
      const next = lines[i + 1];
      if (next && !IGNORED_AMOUNT_LINES.test(next)) {
        const below = amountsIn(next)[0] ?? bareAmount(next);
        if (below !== undefined) return below;
      }
    }
  }
  // No labelled amount: the largest currency amount, which is usually the total.
  const all = lines.filter((line) => !IGNORED_AMOUNT_LINES.test(line)).flatMap(amountsIn);
  return all.length > 0 ? Math.max(...all) : undefined;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function validDate(year: number, month: number, day: number): string | undefined {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return undefined;
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1) return undefined;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function findDate(text: string): string | undefined {
  const monthFirst = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (monthFirst) {
    const date = validDate(Number(monthFirst[3]), MONTHS[monthFirst[1].toLowerCase()], Number(monthFirst[2]));
    if (date) return date;
  }
  const dayFirst = text.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})/i);
  if (dayFirst) {
    const date = validDate(Number(dayFirst[3]), MONTHS[dayFirst[2].toLowerCase()], Number(dayFirst[1]));
    if (date) return date;
  }
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const date = validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) return date;
  }
  // Philippine apps write numeric dates month first: 11/09/2026.
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numeric) {
    return validDate(Number(numeric[3]), Number(numeric[1]), Number(numeric[2]));
  }
  return undefined;
}

function cleanMerchant(value: string): string | undefined {
  const cleaned = value.replace(/\s{2,}/g, ' ').trim();
  if (!cleaned || cleaned.length < 2 || PHONE_LIKE.test(cleaned) || amountsIn(cleaned).length > 0) return undefined;
  return cleaned.slice(0, 60);
}

function findMerchant(lines: string[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!MERCHANT_LABELS.test(line)) continue;
    const rest = cleanMerchant(line.replace(MERCHANT_LABELS, ''));
    if (rest) return rest;
    // The name is often on the next line, with the masked number after it.
    for (const next of lines.slice(i + 1, i + 3)) {
      const name = cleanMerchant(next);
      if (name) return name;
    }
  }
  return undefined;
}

function findReference(text: string): string | undefined {
  const match = text.match(/\bref(?:erence)?\.?\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9][A-Z0-9 -]{5,})/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : undefined;
}

function findSource(text: string): ReceiptSource | undefined {
  if (/gcash/i.test(text)) return 'gcash';
  if (/\b(?:pay)?maya\b/i.test(text)) return 'maya';
  if (/instapay|pesonet|\b(?:bpi|bdo|metrobank|unionbank|landbank|security bank|rcbc|chinabank|pnb|gotyme|seabank|maribank)\b/i.test(text)) {
    return 'bank';
  }
  return undefined;
}

export function parseReceipt(lines: string[]): ParsedReceipt {
  const cleaned = lines.map((line) => line.trim()).filter(Boolean);
  const text = cleaned.join('\n');
  const merchant = findMerchant(cleaned);
  const income = /you received|received from|money received|cash[- ]?in|incoming/i.test(text);

  return {
    amount: findAmount(cleaned),
    date: findDate(text),
    merchant,
    reference: findReference(text),
    source: findSource(text),
    type: income ? 'income' : 'expense',
    category: BILLER_CATEGORIES.find(([pattern]) => pattern.test(merchant ?? text))?.[1],
  };
}

/** The description to prefill: merchant and reference number. */
export function receiptDescription(receipt: ParsedReceipt): string | undefined {
  const parts = [receipt.merchant, receipt.reference ? `Ref ${receipt.reference}` : undefined].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
