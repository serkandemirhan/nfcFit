import React from 'react';
import { View, Text, Button, StyleSheet, SafeAreaView, ScrollView, TextInput } from 'react-native';

const LoginScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>NFC Task Tracker</Text>
        
        <View style={styles.formContainer}>
            <Text style={styles.label}>Kullanıcı Adı</Text>
            <TextInput
                style={styles.input}
                placeholder="admin"
                placeholderTextColor="#6B7280"
            />
            <Text style={styles.label}>Şifre</Text>
            <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#6B7280"
                secureTextEntry
            />
            <Button title="Giriş Yap" onPress={() => navigation.navigate('AdminDashboard')} />
        </View>

        <View style={styles.separator} />

        <Text style={styles.quickLoginTitle}>Hızlı Giriş (Test)</Text>
        <View style={styles.buttonContainer}>
          <Button title="Ahmet Yılmaz olarak giriş yap" onPress={() => navigation.navigate('TaskList')} />
          <Button title="Admin olarak giriş yap" onPress={() => navigation.navigate('AdminDashboard')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ 
    container: { flex: 1, backgroundColor: '#111827' }, 
    scrollContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }, 
    title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 30 }, 
    formContainer: { width: '90%', marginBottom: 20 },
    label: { color: '#D1D5DB', marginBottom: 8, fontSize: 16 },
    input: { backgroundColor: '#374151', color: 'white', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, marginBottom: 20, fontSize: 16 },
    quickLoginTitle: { fontSize: 20, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 15, textAlign: 'center' }, 
    buttonContainer: { width: '90%', gap: 12 }, 
    separator: { height: 1, backgroundColor: '#374151', width: '90%', marginVertical: 30 } 
});
export default LoginScreen;