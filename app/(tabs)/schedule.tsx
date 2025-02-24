import { StyleSheet } from 'react-native';
import { Text } from 'react-native';
import { View } from 'react-native';

export default function Schedule() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});