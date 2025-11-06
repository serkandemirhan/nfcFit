import React from 'react';
import { View, Text, Button, StyleSheet, SafeAreaView, FlatList, Image } from 'react-native';

const AdminUsersScreen = ({ navigation }: any) => {
  // Placeholder data
  const users = [
    { id: 'u1', name: 'Ahmet Yılmaz', username: 'ahmet', avatarurl: 'https://i.imgur.com/k73bB6w.png' },
    { id: 'u2', name: 'Ayşe Kaya', username: 'ayse', avatarurl: 'https://i.imgur.com/k73bB6w.png' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Kullanıcı Yönetimi</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <Image source={{ uri: item.avatarurl }} style={styles.avatar} />
            <View>
              <Text style={styles.itemText}>{item.name}</Text>
              <Text style={styles.itemUsername}>@{item.username}</Text>
            </View>
          </View>
        )}
      />
      <Button title="Yeni Kullanıcı Ekle" onPress={() => alert('Yeni Kullanıcı Ekleme Modalı Açılacak')} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', padding: 20, textAlign: 'center' },
  itemContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', padding: 15, marginVertical: 8, marginHorizontal: 16, borderRadius: 8 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  itemText: { fontSize: 16, color: 'white', fontWeight: 'bold' },
  itemUsername: { fontSize: 14, color: '#9CA3AF' },
});

export default AdminUsersScreen;