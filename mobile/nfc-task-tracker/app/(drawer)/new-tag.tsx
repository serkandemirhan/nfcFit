import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useState } from 'react';
import type React from 'react';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createCard } from '@/lib/api';

export default function NewTagScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [uid, setUid] = useState('');

  const saveMutation = useMutation({
    mutationFn: () =>
      createCard({
        uid: uid.trim(),
        alias: name.trim() || 'Yeni NFC Tag',
        assignedUserId: user?.id ?? 'u1',
      }),
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      Alert.alert('Başarılı', 'Yeni kart eklendi. Şimdi bir aksiyona bağlayabilirsin.', [
        { text: 'Bağla', onPress: () => router.replace(`/(drawer)/card/${card.id}` as never) },
        { text: 'Sonra', onPress: () => router.back(), style: 'cancel' },
      ]);
    },
    onError: (error: Error) => Alert.alert('Hata', error.message || 'NFC tag kaydedilemedi'),
  });

  const handleSave = () => {
    if (!uid.trim()) {
      Alert.alert('Eksik bilgi', 'NFC UID zorunludur.');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={surface.text} />
            <ThemedText style={styles.backText}>Geri</ThemedText>
          </Pressable>
          <ThemedText style={styles.title}>Yeni NFC Tag</ThemedText>
          <ThemedText style={[styles.subtitle, { color: surface.mutedText }]}>
            Kart önce hesaba eklenir. Fitness veya wellness aksiyonunu kart detayında seçersin.
          </ThemedText>
        </View>

        <View style={[styles.form, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <Field label="Tag adı">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Su Tag'i"
              placeholderTextColor={surface.mutedText}
              style={[styles.input, { color: surface.text, borderColor: surface.border }]}
            />
          </Field>

          <Field label="NFC UID">
            <View style={styles.uidRow}>
              <TextInput
                value={uid}
                onChangeText={setUid}
                placeholder="04:6a:9c..."
                placeholderTextColor={surface.mutedText}
                autoCapitalize="characters"
                style={[styles.input, styles.uidInput, { color: surface.text, borderColor: surface.border }]}
              />
              <Pressable style={styles.scanSmallButton} onPress={() => router.push('/(drawer)/nfc')}>
                <Ionicons name="scan-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </Field>

          <Pressable style={styles.saveButton} onPress={handleSave} disabled={saveMutation.isPending}>
            <ThemedText style={styles.saveText}>{saveMutation.isPending ? 'Ekleniyor...' : 'Kartı Ekle'}</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
      <AppBottomNav />
    </ThemedView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, paddingBottom: bottomNavHeight + 24, gap: 14 },
  header: { gap: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  form: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 14 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  uidRow: { flexDirection: 'row', gap: 8 },
  uidInput: { flex: 1 },
  scanSmallButton: { width: 44, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  saveButton: { backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
