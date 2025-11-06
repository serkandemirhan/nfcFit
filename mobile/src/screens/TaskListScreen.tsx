import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

const TaskListScreen = ({ navigation }: any) => {
  return (
    <View style={styles.container}>
      <Text>Task List Screen</Text>
      <Button title="Go to Task Detail" onPress={() => navigation.navigate('TaskDetail')} />
    </View>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
export default TaskListScreen;