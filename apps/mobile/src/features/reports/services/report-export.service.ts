import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { ReportsApi } from '../api/reports.api';
import type { ReportFilters } from '../api/reports.api';
import { buildReportHtml } from './report-html';

export type ExportFormat = 'pdf' | 'excel';

const FILE_TYPES = {
  pdf: { extension: 'pdf', mimeType: 'application/pdf', uti: 'com.adobe.pdf' },
  excel: {
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uti: 'org.openxmlformats.spreadsheetml.sheet',
  },
} as const;

// A4 at 72 PPI
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

function getFileName(filters: ReportFilters, format: ExportFormat): string {
  const period =
    filters.startDate === '2000-01-01' ? 'All-Time' : `${filters.startDate}_to_${filters.endDate}`;
  return `FinTrack-Report_${period}.${FILE_TYPES[format].extension}`;
}

function downloadInBrowser(bytes: ArrayBuffer, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: FILE_TYPES.excel.mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export interface PreparedReport {
  file: File;
  fileName: string;
  format: ExportFormat;
}

export class ReportExportService {
  /**
   * Builds the report in the app's cache. Resolves to 'empty' when the period
   * has no transactions, or 'opened' on web, where the browser takes over.
   */
  static async prepare(
    filters: ReportFilters,
    format: ExportFormat,
    walletName?: string,
  ): Promise<PreparedReport | 'empty' | 'opened'> {
    const rows = await ReportsApi.getExportRows(filters);
    if (rows.length === 0) return 'empty';

    const fileName = getFileName(filters, format);
    const html = () =>
      buildReportHtml(rows, { startDate: filters.startDate, endDate: filters.endDate, walletName });

    if (Platform.OS === 'web') {
      if (format === 'pdf') {
        await Print.printAsync({ html: html() });
      } else {
        downloadInBrowser(await ReportsApi.getWorkbook(filters), fileName);
      }
      return 'opened';
    }

    const file = new File(Paths.cache, fileName);
    if (format === 'excel') {
      const bytes = await ReportsApi.getWorkbook(filters);
      file.create({ overwrite: true });
      file.write(new Uint8Array(bytes));
    } else {
      const { uri } = await Print.printToFileAsync({
        html: html(),
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      });
      const printed = new File(uri);
      await printed.copy(file, { overwrite: true });
      printed.delete();
    }

    return { file, fileName, format };
  }

  /** Android only: lets the user pick a folder and copies the report there. */
  static async saveToDevice({ file, fileName, format }: PreparedReport): Promise<void> {
    const directory = await Directory.pickDirectoryAsync();
    const saved = directory.createFile(fileName, FILE_TYPES[format].mimeType);
    saved.write(await file.bytes());
  }

  static async share({ file, format }: PreparedReport): Promise<void> {
    const { mimeType, uti } = FILE_TYPES[format];
    await Sharing.shareAsync(file.uri, {
      mimeType,
      UTI: uti,
      dialogTitle: 'Share report',
    });
  }
}
