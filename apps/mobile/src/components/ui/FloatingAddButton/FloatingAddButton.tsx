import { Pressable, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FloatingAddButtonProps {
  label: string;
  onPress: () => void;
}

/** A labelled "＋ Add …" button floating at the bottom right of a screen. */
export function FloatingAddButton({ label, onPress }: FloatingAddButtonProps) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-80"
      style={{
        position: 'absolute',
        right: 20,
        // Absolute children sit over the screen's bottom padding, so clear
        // the system navigation bar explicitly.
        bottom: 20 + insets.bottom,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#2563EB',
        borderRadius: 999,
        paddingLeft: 22,
        paddingRight: 28,
        paddingVertical: 16,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
      <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}
