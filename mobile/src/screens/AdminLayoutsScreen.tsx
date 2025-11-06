import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const AdminLayoutsScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Yerleşim Yönetimi</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#111827' }, title: { fontSize: 24, fontWeight: 'bold', color: 'white', padding: 20, textAlign: 'center' } });
export default AdminLayoutsScreen;