import {
  View,
  Text,
  Pressable,
  Modal as RNModal,
  ScrollView,
} from 'react-native';

import { ModalProps } from './Modal.types';

export default function Modal({
  visible,
  onClose,
  title,
  children,
  style,
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 justify-end"
        onPress={onClose}
      >
        <Pressable
          className="bg-surface rounded-t-3xl px-lg pt-sm"
          style={[
            {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.12,
              shadowRadius: 20,
              elevation: 16,
              paddingBottom: 36,
            },
            style,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag Handle */}
          <View className="w-10 h-1 bg-border rounded-full self-center mb-md mt-sm" />

          {title && (
            <View className="flex-row items-center justify-between mb-lg">
              <Text className="text-title font-bold text-text">{title}</Text>
              <Pressable
                className="w-8 h-8 rounded-full bg-surface-alt items-center justify-center"
                onPress={onClose}
              >
                <Text className="text-text-secondary font-bold text-body">✕</Text>
              </Pressable>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}