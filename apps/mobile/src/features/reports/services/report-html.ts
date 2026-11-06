import { formatCurrency, formatDate, formatDateRange, getLocalISODate } from '@/shared/utils/categories';
import type { ExportRow } from '../types';

const AMOUNT_SIGNS: Record<ExportRow['type'], string> = {
  income: '+',
  expense: '-',
  transfer: '',
  adjust_in: '+',
  adjust_out: '-',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function summarizeRows(rows: ExportRow[]) {
  let income = 0;
  let expense = 0;
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (row.type === 'income') income += row.amount;
    if (row.type === 'expense') {
      expense += row.amount;
      totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
    }
  }

  const categories = [...totals]
    .map(([name, total]) => ({ name, total, share: total / expense }))
    .sort((a, b) => b.total - a.total);

  return { income, expense, net: income - expense, categories };
}

export function buildReportHtml(
  rows: ExportRow[],
  options: { startDate: string; endDate: string; walletName?: string },
): string {
  const { income, expense, net, categories } = summarizeRows(rows);
  const scope = options.walletName ?? 'All wallets';

  const categoryRows = categories
    .map(
      (category) => `
        <tr>
          <td>${escapeHtml(category.name)}</td>
          <td class="bar"><div style="width: ${(category.share * 100).toFixed(1)}%"></div></td>
          <td class="number">${(category.share * 100).toFixed(1)}%</td>
          <td class="number">${formatCurrency(category.total)}</td>
        </tr>`,
    )
    .join('');

  const transactionRows = rows
    .map(
      (row) => `
        <tr>
          <td class="date">${formatDate(row.date)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(row.wallet)}</td>
          <td class="number ${row.type}">${AMOUNT_SIGNS[row.type]}${formatCurrency(row.amount)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 32px; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: sans-serif; font-size: 10px; color: #111827; }
    header { display: flex; justify-content: space-between; align-items: flex-end;
      padding-bottom: 12px; border-bottom: 2px solid #2563EB; }
    .brand { font-size: 12px; font-weight: 700; color: #2563EB; }
    h1 { margin: 2px 0 0; font-size: 20px; }
    .meta { text-align: right; color: #6B7280; line-height: 1.5; }
    .totals { display: flex; gap: 8px; margin: 16px 0 20px; }
    .total { flex: 1; padding: 10px 12px; border-radius: 8px; background: #F3F4F6; }
    .total span { display: block; color: #6B7280; margin-bottom: 2px; }
    .total strong { font-size: 14px; }
    h2 { margin: 0 0 6px; font-size: 12px; }
    section { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th { padding: 6px; text-align: left; color: #6B7280; font-weight: 600;
      border-bottom: 1px solid #D1D5DB; }
    td { padding: 6px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
    .number { text-align: right; white-space: nowrap; }
    .date { white-space: nowrap; }
    .bar { width: 34%; vertical-align: middle; }
    .bar div { height: 6px; border-radius: 3px; background: #2563EB; }
    .income { color: #16A34A; }
    .expense { color: #DC2626; }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="brand">FinTrack</div>
      <h1>Financial Report</h1>
    </div>
    <div class="meta">
      <div>${escapeHtml(formatDateRange(options.startDate, options.endDate))}</div>
      <div>${escapeHtml(scope)}</div>
      <div>Generated ${formatDate(getLocalISODate())}</div>
    </div>
  </header>

  <div class="totals">
    <div class="total"><span>Income</span><strong class="income">${formatCurrency(income)}</strong></div>
    <div class="total"><span>Expenses</span><strong class="expense">${formatCurrency(expense)}</strong></div>
    <div class="total"><span>Net</span><strong>${formatCurrency(net)}</strong></div>
    <div class="total"><span>Transactions</span><strong>${rows.length}</strong></div>
  </div>

  ${
    categories.length > 0
      ? `<section>
    <h2>Spending by Category</h2>
    <table>
      <thead><tr><th>Category</th><th></th><th class="number">Share</th><th class="number">Amount</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>
  </section>`
      : ''
  }

  <section>
    <h2>Transactions</h2>
    <table>
      <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Wallet</th><th class="number">Amount</th></tr></thead>
      <tbody>${transactionRows}</tbody>
    </table>
  </section>
</body>
</html>`;
}
