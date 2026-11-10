import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NFCInspection, nfcManager } from '@/lib/nfc-manager';

type WriteMode = 'text' | 'url';

export default function NfcTestScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const [inspection, setInspection] = useState<NFCInspection | null>(null);
  const [writeMode, setWriteMode] = useState<WriteMode>('text');
  const [value, setValue] = useState('Test workout tag');
  const [testCardConfirmed, setTestCardConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const inspect = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await nfcManager.inspectTag();
      setInspection(result);
      setNotice('Kart bilgileri okundu. NDEF içerik değerleri gizlilik için gösterilmez.');
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Kart okunamadı.');
    } finally {
      setBusy(false);
    }
  };

  const writeTestRecord = () => {
    if (!testCardConfirmed) {
      setError('Yazma için kartın test kartı olduğunu onaylamalısın.');
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Yazılacak değeri gir.');
      return;
    }
    Alert.alert(
      'NDEF içeriği değiştirilecek',
      'Bu işlem karttaki mevcut NDEF kayıtlarının üzerine NFCFit test verisi yazar. Yalnızca test kartında devam et.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Test verisini yaz', onPress: () => { void performWrite(trimmed); } },
      ]
    );
  };

  const resetTestCard = () => {
    if (!testCardConfirmed) {
      setError('Sıfırlama için kartın test kartı olduğunu onaylamalısın.');
      return;
    }
    Alert.alert(
      'Test kartının NDEF içeriği değiştirilecek',
      'Mevcut tüm NDEF kayıtları NFCFit:RESET metniyle değiştirilecek. Bu işlem geri alınamaz. MifareClassic sektör verilerine dokunulmaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Test kartını sıfırla', style: 'destructive', onPress: () => { void performReset(); } },
      ]
    );
  };

  const performWrite = async (text: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (writeMode === 'text') {
        await nfcManager.writeDiagnosticText(text);
      } else {
        await nfcManager.writeDiagnosticUrl(text);
      }
      setNotice('Yazma başarılı. Doğrulamak için kartı tekrar okut.');
      setInspection(null);
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : 'NDEF kaydı yazılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const performReset = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await nfcManager.resetDiagnosticTag();
      setNotice('Test kartının NDEF içeriği NFCFit:RESET olarak değiştirildi. Doğrulamak için kartı tekrar okut.');
      setInspection(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Test kartı sıfırlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const cardStyle = { backgroundColor: surface.card, borderColor: surface.border };
  const primaryButton = [styles.button, { backgroundColor: surface.green }];

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>NFC ARAÇLARI</ThemedText>
          <ThemedText style={styles.title}>Kart testi</ThemedText>
          <ThemedText style={[styles.description, { color: surface.mutedText }]}>
            Teknoloji türünü ve NDEF yazılabilirliğini kontrol et; yalnızca test kartına NFCFit örnek verisi yaz.
          </ThemedText>
        </View>

        <View style={[styles.card, cardStyle]}>
          <ThemedText style={styles.cardTitle}>Kartı kontrol et</ThemedText>
          <ThemedText style={[styles.body, { color: surface.mutedText }]}>
            Kartı okutunca UID, algılanan teknoloji adları ve NDEF kayıt özeti gösterilir. Karttaki kayıt içerikleri ekranda açığa çıkarılmaz.
          </ThemedText>
          <TouchableOpacity style={primaryButton} onPress={() => void inspect()} disabled={busy}>
            <Ionicons name="scan-outline" size={20} color="#fff" />
            <ThemedText style={styles.buttonText}>{busy ? 'Bekleyin…' : 'Kartı okut ve kontrol et'}</ThemedText>
          </TouchableOpacity>
        </View>

        {inspection && (
          <View style={[styles.card, cardStyle]}>
            <ThemedText style={styles.cardTitle}>Okuma sonucu</ThemedText>
            <InfoRow label="UID" value={inspection.id} />
            <InfoRow label="Kart tipi" value={inspection.type} />
            <InfoRow label="Algılanan teknolojiler" value={inspection.techTypes.join(', ') || 'Bilinmiyor'} />
            <InfoRow label="NDEF durumu" value={ndefStatusLabel(inspection.ndefStatus)} />
            <InfoRow label="NDEF kapasitesi" value={inspection.ndefCapacity === null ? 'Bilinmiyor' : `${inspection.ndefCapacity} byte`} />
            <InfoRow label="NDEF kayıt adedi" value={String(inspection.records.length)} />
            {inspection.records.map((record, index) => (
              <InfoRow
                key={`${record.type}-${index}`}
                label={`Kayıt ${index + 1}`}
                value={`${record.type} · TNF ${record.tnf} · ${record.payloadBytes} byte`}
              />
            ))}
            <View style={[styles.note, { backgroundColor: surface.cardRaised }]}>
              <ThemedText style={[styles.noteText, { color: surface.mutedText }]}>
                NfcA, kartın Type A radyo arayüzünü; NDEF ise veri biçimini belirtir. MifareClassic görünmesi, uygulamanın kartı doğruladığı veya Technogym ile uyumlu olduğu anlamına gelmez. Bu araç MifareClassic sektörlerini okumaz ya da yazmaz.
              </ThemedText>
            </View>
          </View>
        )}

        <View style={[styles.card, cardStyle]}>
          <ThemedText style={styles.cardTitle}>NFCFit test verisi kodla</ThemedText>
          <ThemedText style={[styles.body, { color: surface.mutedText }]}>
            Mevcut NDEF içeriğinin üzerine örnek metin veya HTTPS adresi yazar. Yalnızca boş/test kartında kullan.
          </ThemedText>
          <View style={[styles.segment, { backgroundColor: surface.cardRaised }]}>
            {(['text', 'url'] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: writeMode === mode }}
                onPress={() => {
                  setWriteMode(mode);
                  setValue(mode === 'text' ? 'Test workout tag' : 'https://example.com/nfc-test');
                  setError('');
                }}
                style={[styles.segmentButton, writeMode === mode && { backgroundColor: surface.green }]}>
                <ThemedText style={[styles.segmentText, writeMode === mode && styles.buttonText]}>
                  {mode === 'text' ? 'Test metni' : 'HTTPS adresi'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoCapitalize={writeMode === 'url' ? 'none' : 'sentences'}
            autoCorrect={writeMode !== 'url'}
            keyboardType={writeMode === 'url' ? 'url' : 'default'}
            maxLength={writeMode === 'text' ? 200 : 2048}
            placeholder={writeMode === 'text' ? 'Test metni' : 'https://example.com/nfc-test'}
            placeholderTextColor={surface.mutedText}
            style={[styles.input, { color: surface.text, borderColor: surface.border, backgroundColor: surface.cardRaised }]}
            accessibilityLabel={writeMode === 'text' ? 'NFC test metni' : 'NFC test HTTPS adresi'}
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: testCardConfirmed }}
            onPress={() => {
              setTestCardConfirmed((current) => !current);
              setError('');
            }}
            style={styles.confirmRow}>
            <Ionicons
              name={testCardConfirmed ? 'checkbox' : 'square-outline'}
              size={22}
              color={testCardConfirmed ? surface.green : surface.mutedText}
            />
            <ThemedText style={[styles.confirmText, { color: surface.text }]}>
              Bu kartın yalnızca bana ait bir test kartı olduğunu ve mevcut NDEF verisinin değiştirilebileceğini onaylıyorum.
            </ThemedText>
          </Pressable>

          {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
          {notice ? <ThemedText accessibilityRole="alert" style={[styles.notice, { color: surface.green }]}>{notice}</ThemedText> : null}

          <TouchableOpacity
            style={primaryButton}
            onPress={writeTestRecord}
            disabled={busy || !testCardConfirmed}>
            <Ionicons name="create-outline" size={20} color="#fff" />
            <ThemedText style={styles.buttonText}>{busy ? 'İşleniyor…' : 'NFCFit test verisi yaz'}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={resetTestCard}
            disabled={busy || !testCardConfirmed}>
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <ThemedText style={styles.buttonText}>NDEF içeriğini NFCFit test işaretiyle değiştir</ThemedText>
          </TouchableOpacity>
          <ThemedText style={[styles.warning, { color: surface.mutedText }]}>
            Sıfırlama kartı boş bırakmaz; NDEF kayıtlarını NFCFit:RESET metniyle değiştirir. Kartın MifareClassic sektörlerine veya fabrika ayarlarına dokunmaz.
          </ThemedText>
        </View>
      </ScrollView>
      <AppBottomNav />
    </ThemedView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
    </View>
  );
}

function ndefStatusLabel(status: NFCInspection['ndefStatus']) {
  switch (status) {
    case 'read-write': return 'Okunabilir / yazılabilir';
    case 'read-only': return 'Salt okunur';
    case 'not-supported': return 'NDEF desteklenmiyor';
    default: return 'Belirlenemedi';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, paddingBottom: bottomNavHeight + 24, gap: 12 },
  header: { gap: 4, paddingHorizontal: 2 },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, color: '#16803C' },
  title: { fontSize: 26, fontWeight: '900' },
  description: { fontSize: 13, lineHeight: 19 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '900' },
  body: { fontSize: 13, lineHeight: 19 },
  button: { minHeight: 46, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  resetButton: { backgroundColor: '#9f2d2d' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(148,163,184,0.22)', paddingTop: 9 },
  infoLabel: { flex: 0.9, fontSize: 12, opacity: 0.7 },
  infoValue: { flex: 1.3, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  note: { borderRadius: 10, padding: 11 },
  noteText: { fontSize: 12, lineHeight: 18 },
  segment: { flexDirection: 'row', borderRadius: 11, padding: 4, gap: 4 },
  segmentButton: { flex: 1, minHeight: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentText: { fontSize: 12, fontWeight: '800', opacity: 0.75 },
  input: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  confirmText: { flex: 1, fontSize: 12, lineHeight: 18 },
  error: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  notice: { fontSize: 13, fontWeight: '700' },
  warning: { fontSize: 11, lineHeight: 16 },
});
