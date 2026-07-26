import {
  View,
  Text,
  Pressable,
  Modal as RNModal,
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
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-center items-center px-xl"
        onPress={onClose}
      >
        <Pressable
          className="bg-surface rounded-lg p-lg w-full max-w-[400px] shadow-lg"
          style={[
            {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            },
            style,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {title && (
            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-title font-semibold text-text">{title}</Text>

              <Pressable className="p-1" onPress={onClose}>
                <Text className="text-title text-text-secondary">✕</Text>
              </Pressable>
            </View>
          )}

          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}