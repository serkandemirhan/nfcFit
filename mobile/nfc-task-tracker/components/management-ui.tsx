import { KeyboardFrame } from "./keyboard-frame";
import { Picker } from '@react-native-picker/picker';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { nfcManager } from '@/lib/nfc-manager';

export const roleLabels: Record<string, string> = { owner: 'Kulüp yöneticisi', admin: 'Operasyon yöneticisi', coach: 'Antrenör', CLUB_ADMIN: 'Kulüp yöneticisi', CLUB_MANAGER: 'Operasyon yöneticisi', TRAINER: 'Antrenör' };
export const statusLabels: Record<string, string> = { active: 'Aktif', inactive: 'Pasif', suspended: 'Askıda', pending: 'Onay bekliyor', rejected: 'Reddedildi', removed: 'Kaldırıldı' };
export const unitLabels: Record<string, string> = { seconds: 'saniye', minutes: 'dakika', repetition: 'tekrar', meters: 'metre' };
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'İşlem tamamlanamadı. Tekrar deneyin.';

export function ManagementCard({ title, hint, children }: { title?: string; hint?: string; children?: ReactNode }) {
  const palette = getSurfaceColors(useColorScheme());
  return <View style={[ui.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
    {title && <ThemedText style={ui.cardTitle}>{title}</ThemedText>}
    {hint && <ThemedText style={[ui.hint, { color: palette.mutedText }]}>{hint}</ThemedText>}
    {children}
  </View>;
}

export function ManagementButton({ title, onPress, disabled, secondary = false, danger = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean;
}) {
  const palette = getSurfaceColors(useColorScheme());
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, { backgroundColor: secondary ? palette.cardRaised : danger ? '#B91C1C' : palette.green, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
    <ThemedText style={[ui.buttonText, { color: secondary ? danger ? '#DC2626' : palette.text : '#FFFFFF' }]}>{title}</ThemedText>
  </Pressable>;
}

export function ManagementMessage({ message, error = false }: { message: string; error?: boolean }) {
  return <ThemedText accessibilityRole="alert" accessibilityLiveRegion="polite" style={[ui.message, { color: error ? '#B91C1C' : '#16803C', backgroundColor: error ? '#FEE2E2' : '#DCFCE7' }]}>{message}</ThemedText>;
}

export function ManagementPicker({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: { label: string; value: string }[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const palette = getSurfaceColors(useColorScheme());
  return <View style={ui.field}>
    <ThemedText style={ui.label}>{label}</ThemedText>
    <View style={[ui.picker, { borderColor: palette.border, backgroundColor: palette.cardRaised }]}>
      <Picker accessibilityLabel={label} enabled={!disabled} selectedValue={value} onValueChange={onChange} style={{ color: palette.text }} dropdownIconColor={palette.text}>
        {options.map(option => <Picker.Item key={option.value} label={option.label} value={option.value} color={Platform.OS === 'ios' ? palette.text : undefined} />)}
      </Picker>
    </View>
  </View>;
}

export type ManagementField = {
  key: string; label: string; initial?: string; placeholder?: string;
  options?: { label: string; value: string }[];
  type?: 'number' | 'email'; min?: number; max?: number; integer?: boolean; minLength?: number; maxLength?: number; pattern?: RegExp;
  required?: boolean;
};
export type ManagementForm = {
  title: string; hint?: string; fields: ManagementField[]; scanUid?: boolean;
  save: (values: Record<string, string>) => Promise<void>;
};

export function ManagementFormSheet({ form, onClose }: { form: ManagementForm; onClose: () => void }) {
  const palette = getSurfaceColors(useColorScheme());
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(form.fields.map(field => [field.key, field.initial ?? field.options?.[0]?.value ?? ''])));
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const scanPending = useRef(false);
  const scanController = useRef<AbortController | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      scanController.current?.abort();
      if (scanPending.current) void nfcManager.cancelScan();
    };
  }, []);

  const scan = async () => {
    if (scanPending.current || saving.current) return;
    scanPending.current = true;
    scanController.current = new AbortController();
    setScanning(true); setError(''); setNotice('');
    try {
      if (Platform.OS === 'web') throw new Error('Tarayıcıda UID’yi elle girin. Telefonla okutmak için NFCFit uygulamasını kullanın.');
      if (!await nfcManager.init()) throw new Error('Bu cihazda NFC kullanılamıyor. UID’yi elle girebilirsiniz.');
      if (!alive.current) return;
      if (!await nfcManager.checkEnabled()) throw new Error('Telefonun ayarlarından NFC’yi açıp tekrar deneyin.');
      if (!alive.current) return;
      setNotice('Kartı telefonun NFC alanına yaklaştırın.');
      const tag = await nfcManager.readTag(scanController.current.signal);
      if (!tag || tag.id === 'unavailable') throw new Error('Kart UID’si okunamadı. Tekrar deneyin.');
      if (alive.current) {
        setValues(current => ({ ...current, uid: tag.id }));
        setNotice('Kart okundu. Ad verip kaydedin; egzersizi daha sonra da bağlayabilirsiniz.');
      }
    } catch (err) {
      if (alive.current) {
        if (scanController.current?.signal.aborted) setNotice('Okuma iptal edildi. Tekrar okutabilir veya UID’yi elle girebilirsiniz.');
        else { setError(errorMessage(err)); setNotice(''); }
      }
    } finally {
      scanPending.current = false;
      if (alive.current) setScanning(false);
    }
  };

  const save = async () => {
    if (saving.current || scanPending.current) return;
    setError('');
    const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
    for (const field of form.fields) {
      const value = trimmed[field.key] ?? '';
      if (!value && field.required === false) continue;
      if (!value || value.length < (field.minLength ?? 1)) { setError(`${field.label}: en az ${field.minLength ?? 1} karakter girin.`); return; }
      if (field.maxLength && value.length > field.maxLength) { setError(`${field.label}: en fazla ${field.maxLength} karakter girin.`); return; }
      if (field.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { setError('Geçerli bir e-posta adresi girin.'); return; }
      if (field.pattern && !field.pattern.test(value)) { setError(`${field.label}: geçerli bir değer girin.`); return; }
      if (field.options && !field.options.some(option => option.value === value)) { setError(`${field.label} seçin.`); return; }
      if (field.type === 'number') {
        trimmed[field.key] = value.replace(',', '.');
        const number = Number(trimmed[field.key]);
        if (!Number.isFinite(number) || number < (field.min ?? 0) || number > (field.max ?? Infinity) || (field.integer && !Number.isInteger(number))) {
          setError(`${field.label}: ${field.min ?? 0}–${field.max ?? '∞'} aralığında ${field.integer ? 'tam sayı' : 'sayı'} girin.`); return;
        }
      }
    }
    saving.current = true; setBusy(true);
    try { await form.save(trimmed); if (alive.current) onClose(); }
    catch (err) { if (alive.current) setError(errorMessage(err)); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  };

  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top, paddingBottom: insets.bottom }}><KeyboardFrame style={{flex:1}}>
      <View style={[ui.sheetHeader, { borderColor: palette.border }]}>
        <ThemedText style={[ui.cardTitle, { flex: 1 }]}>{form.title}</ThemedText>
        <ManagementButton title="Kapat" secondary disabled={busy} onPress={onClose} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingBottom: insets.bottom + 24 }]}>
        {form.hint && <ThemedText style={[ui.hint, { color: palette.mutedText }]}>{form.hint}</ThemedText>}
        {form.scanUid && <ManagementButton title={scanning ? 'Kart bekleniyor…' : 'NFC ile kartı okut'} disabled={scanning || busy} onPress={() => void scan()} />}
        {scanning && <ManagementButton title="Okumayı iptal et" secondary onPress={() => { scanController.current?.abort(); void nfcManager.cancelScan(); }} />}
        {notice !== '' && <ManagementMessage message={notice} />}
        {form.fields.map(field => field.options ? <ManagementPicker key={field.key} label={field.label} value={values[field.key]} options={field.options} disabled={busy || scanning} onChange={value => setValues(current => ({ ...current, [field.key]: value }))} /> :
          <View key={field.key} style={ui.field}>
            <ThemedText style={ui.label}>{field.label}</ThemedText>
            <TextInput accessibilityLabel={field.label} editable={!busy && !scanning} value={values[field.key]} onChangeText={value => setValues(current => ({ ...current, [field.key]: value }))}
              placeholder={field.placeholder} placeholderTextColor={palette.mutedText} autoCorrect={false} autoCapitalize={field.type === 'email' || field.key === 'slug' ? 'none' : field.key === 'uid' ? 'characters' : 'sentences'}
              keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'email' ? 'email-address' : 'default'} maxLength={field.maxLength}
              style={[ui.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]} />
          </View>)}
        {error !== '' && <ManagementMessage message={error} error />}
        {busy && <ActivityIndicator color={palette.green} />}
        <ManagementButton title={busy ? 'Kaydediliyor…' : 'Kaydet'} disabled={busy || scanning} onPress={() => void save()} />
      </ScrollView>
    </KeyboardFrame></View>
  </Modal>;
}

export function ManagementDetailsSheet({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const palette = getSurfaceColors(useColorScheme());
  const insets = useSafeAreaInsets();
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)', paddingTop: insets.top + 32 }}>
      <View style={{ backgroundColor: palette.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: insets.bottom }}>
        <View style={[ui.sheetHeader, { borderColor: palette.border }]}><ThemedText numberOfLines={2} style={[ui.cardTitle, { flex: 1 }]}>{title}</ThemedText><ManagementButton title="Kapat" secondary disabled={busy} onPress={onClose} /></View>
        <ScrollView contentContainerStyle={ui.content}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

export const ui = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  card: { padding: 16, borderWidth: 1, borderRadius: 18, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800', lineHeight: 25 },
  title: { fontSize: 25, fontWeight: '800', lineHeight: 32 },
  hint: { fontSize: 13, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700' },
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, minHeight: 48 },
  picker: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  button: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  message: { fontSize: 13, lineHeight: 20, padding: 12, borderRadius: 12, overflow: 'hidden' },
  sheetHeader: { padding: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
