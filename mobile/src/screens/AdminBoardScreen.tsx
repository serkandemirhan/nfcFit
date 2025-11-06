import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const AdminBoardScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Kanban Board</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#111827' }, title: { fontSize: 24, fontWeight: 'bold', color: 'white', padding: 20, textAlign: 'center' } });
export default AdminBoardScreen;