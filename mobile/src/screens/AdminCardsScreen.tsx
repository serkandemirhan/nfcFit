import React from 'react';
import { View, Text, Button, StyleSheet, SafeAreaView, FlatList } from 'react-native';

const AdminCardsScreen = ({ navigation }: any) => {
  // Placeholder data
  const cards = [
    { id: 'NFC01', alias: 'Giriş Kapısı' },
    { id: 'NFC02', alias: 'Sunucu Odası' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>NFC Kart Yönetimi</Text>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <Text style={styles.itemText}>{item.alias}</Text>
            <Text style={styles.itemId}>{item.id}</Text>
          </View>
        )}
      />
      <Button title="Yeni Kart Ekle" onPress={() => alert('Yeni Kart Ekleme Modalı Açılacak')} />
      <Button title="Tara ve Ekle" onPress={() => alert('NFC Tarama Başlatılacak')} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', padding: 20, textAlign: 'center' },
  itemContainer: { backgroundColor: '#1F2937', padding: 15, marginVertical: 8, marginHorizontal: 16, borderRadius: 8 },
  itemText: { fontSize: 16, color: 'white' },
  itemId: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});

export default AdminCardsScreen;