// Android opens fintrack://expo-sharing when an image is shared to FinTrack
// (expo-sharing). Send it to the receipt scanner; every other link is unchanged.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/scan-receipt?shared=1';
    }
    return path;
  } catch {
    return path;
  }
}
