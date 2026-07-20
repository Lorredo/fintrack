import { View, Text } from 'react-native';
import { APP_NAME } from '@/shared/constants/app';

export default function Home() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text>
        {APP_NAME}
      </Text>
    </View>
  );
}