import { View } from 'react-native';

export interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  trackColor?: string;
  height?: number;
  showLabel?: boolean;
}

export default function ProgressBar({
  progress,
  color,
  trackColor = 'bg-border/30',
  height = 8,
}: ProgressBarProps) {
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  const clamped = Math.min(Math.max(safeProgress, 0), 100);

  const barColor = color
    ? { backgroundColor: color }
    : clamped >= 90
    ? { backgroundColor: '#EF4444' }
    : clamped >= 70
    ? { backgroundColor: '#F59E0B' }
    : { backgroundColor: '#22C55E' };

  return (
    <View
      className={`w-full rounded-full overflow-hidden ${trackColor}`}
      style={{ height }}
    >
      <View
        className="h-full rounded-full"
        style={[{ width: `${clamped}%` }, barColor]}
      />
    </View>
  );
}