import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategoryIcon, getCategoryColor } from '@/shared/utils/categories';

export interface CategoryIconProps {
  category: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: { container: 'w-8 h-8 rounded-full', icon: 14 },
  md: { container: 'w-12 h-12 rounded-full', icon: 20 },
  lg: { container: 'w-16 h-16 rounded-full', icon: 28 },
};

export default function CategoryIcon({
  category,
  size = 'md',
}: CategoryIconProps) {
  const color = getCategoryColor(category);
  const { container, icon } = sizeClasses[size];

  return (
    <View
      className={`${container} items-center justify-center`}
      style={{ backgroundColor: `${color}20` }}
    >
      <MaterialCommunityIcons
        name={getCategoryIcon(category)}
        size={icon}
        color={color}
      />
    </View>
  );
}