import { extractTextFromImage, isSupported } from 'expo-text-extractor';
import * as ImagePicker from 'expo-image-picker';

import type { Account } from '@/features/accounts/types';
import { parseReceipt, type ParsedReceipt, type ReceiptSource } from '../utils/parseReceipt';

// Text is read on the phone (ML Kit through Google Play Services), so receipt
// images never leave the device.

export class ReceiptScanError extends Error {}

export async function scanReceipt(uri: string): Promise<ParsedReceipt> {
  if (!isSupported) {
    throw new ReceiptScanError("This phone can't read text from images.");
  }
  let lines: string[];
  try {
    lines = await extractTextFromImage(uri);
  } catch {
    // The first scan needs Google Play Services to download its text model.
    throw new ReceiptScanError("Couldn't read this image. If it's your first scan, connect to the internet once and try again.");
  }
  return parseReceipt(lines);
}

/** Opens the phone's photo picker for a screenshot. Null when cancelled. */
export async function pickReceiptImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

const SOURCE_NAMES: Record<ReceiptSource, RegExp> = {
  gcash: /gcash/i,
  maya: /maya/i,
  bank: /bank|bpi|bdo|metrobank|unionbank|landbank|rcbc|chinabank|pnb|gotyme|seabank|maribank/i,
};

/** The wallet that probably paid, matched by name ("GCash" for a GCash receipt). */
export function matchWallet(source: ReceiptSource | undefined, accounts: Account[] | undefined): string | undefined {
  if (!source || !accounts) return undefined;
  return accounts.find((account) => SOURCE_NAMES[source].test(account.name))?.id;
}
