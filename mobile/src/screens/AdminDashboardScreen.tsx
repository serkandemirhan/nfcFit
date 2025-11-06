import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Button, ScrollView } from 'react-native';

const AdminDashboardScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Admin Paneli</Text>
        <View style={styles.menuContainer}>
          <Button title="Pano (Board)" onPress={() => navigation.navigate('AdminBoard')} />
          <Button title="Görevler" onPress={() => alert("Admin görevler ekranı açılacak")} />
          <Button title="Yerleşimler" onPress={() => navigation.navigate('AdminLayouts')} />
          <Button title="Kullanıcılar" onPress={() => navigation.navigate('AdminUsers')} />
          <Button title="Kartlar" onPress={() => navigation.navigate('AdminCards')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ 
    container: { flex: 1, backgroundColor: '#111827' },
    scrollContainer: { padding: 20 },
    title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 20, textAlign: 'center' },
    menuContainer: { width: '100%', gap: 15 }
});

export default AdminDashboardScreen;