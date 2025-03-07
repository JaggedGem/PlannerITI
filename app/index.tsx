import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { View } from 'react-native';
import { ThemedText } from '../components/ThemedText';

export default function Index() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText>Loading...</ThemedText>
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href={'/(tabs)/schedule' as any} />;
  }

  return <Redirect href={'auth' as any} />;
}