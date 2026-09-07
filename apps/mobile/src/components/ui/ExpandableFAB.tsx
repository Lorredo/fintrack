import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Action {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
}

interface ExpandableFABProps {
  actions: Action[];
  mainIcon?: IconName;
  activeIcon?: IconName;
}

export function ExpandableFAB({ actions, mainIcon = 'plus', activeIcon = 'close' }: ExpandableFABProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => setExpanded(!expanded);

  return (
    <View style={styles.container}>
      {/* Overlay to close when clicking outside */}
      {expanded && (
        <Pressable
          style={styles.overlay}
          onPress={() => setExpanded(false)}
        />
      )}

      {/* Actions */}
      {expanded && (
        <View style={styles.actionsContainer}>
          {actions.map((action, index) => (
            <View key={index} style={styles.actionRow}>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Pressable
                style={[styles.actionButton, { backgroundColor: action.backgroundColor || '#fff' }]}
                onPress={() => {
                  setExpanded(false);
                  action.onPress();
                }}
              >
                <MaterialCommunityIcons name={action.icon} size={20} color={action.color || '#2563EB'} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Main Button */}
      <Pressable
        onPress={actions.length === 1 ? actions[0].onPress : toggleExpanded}
        style={[styles.mainButton, expanded && styles.mainButtonExpanded]}
      >
        <MaterialCommunityIcons name={expanded ? activeIcon : mainIcon} size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    bottom: -1000,
    right: -1000,
    width: 3000,
    height: 3000,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: -1,
    borderRadius: 20, // Just so it doesn't look weird if bounded
  },
  actionsContainer: {
    marginBottom: 16,
    gap: 16,
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  mainButtonExpanded: {
    backgroundColor: '#1E40AF',
  }
});
