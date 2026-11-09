import AuthGuard from '@/shared/navigation/AuthGuard';
import ScanReceiptScreen from '@/features/receipts/screens/ScanReceiptScreen';

// Shared images open this screen directly, so it sits behind the same sign-in
// and PIN check as the rest of the app.
export default function ScanReceiptRoute() {
  return (
    <AuthGuard>
      <ScanReceiptScreen />
    </AuthGuard>
  );
}
