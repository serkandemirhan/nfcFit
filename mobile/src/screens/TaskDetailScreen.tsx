import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TaskDetailScreen = () => {
  return (
    <View style={styles.container}>
      <Text>Task Detail Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
export default TaskDetailScreen;