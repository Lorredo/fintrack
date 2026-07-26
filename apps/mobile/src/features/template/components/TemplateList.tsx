/**
 * Template feature component example.
 * Replace with actual components when scaffolding a new feature.
 */

import { View, Text, FlatList, Pressable } from 'react-native';
import type { TemplateItem } from '../types';

interface TemplateListProps {
  items: TemplateItem[];
  onSelect: (item: TemplateItem) => void;
  onDelete: (id: string) => void;
}

export function TemplateList({ items, onSelect, onDelete }: TemplateListProps) {
  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-lg">
        <Text className="text-textSecondary text-body">No items found</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          className="flex-row items-center justify-between px-md py-3 border-b border-border"
          onPress={() => onSelect(item)}
        >
          <Text className="text-textPrimary text-body font-medium">{item.name}</Text>
          <Pressable onPress={() => onDelete(item.id)} className="p-2">
            <Text className="text-danger text-body">Delete</Text>
          </Pressable>
        </Pressable>
      )}
    />
  );
}