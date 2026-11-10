import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { ManagementButton as Button, ManagementDetailsSheet, ManagementMessage as Message, errorMessage, ui } from '@/components/management-ui';
import { ThemedText } from '@/components/themed-text';
import { nfcManager } from '@/lib/nfc-manager';
import { buildTagLink } from '@/lib/tag-link';
import { ManagedTag, fetchTagWriteLink } from '@/lib/tenant-console';

export function NfcLinkWriter({ tag, tenantId, onClose }: { tag: ManagedTag; tenantId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verified, setVerified] = useState(false);
  const alive = useRef(true);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; controller.current?.abort(); if (pending.current) void nfcManager.cancelScan(); };
  }, []);

  const run = async (write: boolean) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setVerified(false);
    controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      if (Platform.OS === 'web') throw new Error('Kart yazmak için telefondaki NFCFit uygulamasını kullanın.');
      setNotice('Salon yetkisi ve kart kaydı kontrol ediliyor…');
      const link = await fetchTagWriteLink(tenantId, tag.id);
      if (link.tag_id !== tag.id || link.url !== buildTagLink(tag.id)) throw new Error('Kart bağlantısı doğrulanamadı.');
      if (!alive.current || signal.aborted) return;
      if (!await nfcManager.init()) throw new Error('Bu cihazda NFC kullanılamıyor.');
      if (!await nfcManager.checkEnabled()) throw new Error('Telefon ayarlarından NFC’yi açın.');
      if (!alive.current || signal.aborted) return;
      setNotice('Seçtiğiniz kartı telefonun NFC alanına yaklaştırın ve işlem bitene kadar tutun.');
      const matched = write ? (await nfcManager.writeAppLink(link.uid, tag.id, signal)).verified : await nfcManager.verifyAppLink(link.uid, tag.id, signal);
      if (alive.current) {
        setVerified(matched);
        setNotice(matched ? 'Bağlantı karttan okunarak doğrulandı. Kartı uzaklaştırıp tekrar okutarak uygulama açılışını deneyebilirsiniz.' : write
          ? 'Yazma tamamlandı, ancak okuma doğrulaması tamamlanamadı. Kartı uzaklaştırıp “Tekrar okutarak doğrula” seçeneğini kullanın.'
          : 'Karttaki bağlantı beklenen bağlantıyla eşleşmiyor. Yazma işlemini tekrar deneyebilirsiniz.');
      }
    } catch (err) {
      if (alive.current) { setError(signal.aborted ? 'İşlem durduruldu. Yazma başlamış olabileceği için kartı tekrar okutarak doğrulayın.' : errorMessage(err)); setNotice(''); }
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  };

  return <ManagementDetailsSheet title={`${tag.name} · Uygulama bağlantısı`} onClose={onClose} busy={busy}>
    <ThemedText style={ui.hint}>UID: {tag.uid}</ThemedText>
    <ThemedText selectable style={ui.hint}>{buildTagLink(tag.id)}</ThemedText>
    <ThemedText style={ui.hint}>Bu bağlantı egzersiz değişse de aynı kalır. Yazma işlemi karttaki mevcut NDEF içeriğinin üzerine yazar. Karta parola, oturum veya egzersiz verisi yazılmaz.</ThemedText>
    {notice !== '' && <Message message={notice} />}{error !== '' && <Message error message={error} />}
    <Button title={busy ? 'İşlem sürüyor…' : verified ? 'Bağlantıyı yeniden yaz' : 'Bağlantıyı karta yaz'} disabled={busy} onPress={() => Alert.alert('Kartın NDEF içeriği değişecek',
      'Seçtiğiniz karttaki mevcut tüm NDEF kayıtları NFCFit uygulama bağlantısıyla değiştirilecek. Devam edilsin mi?',
      [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Yaz ve doğrula', onPress: () => void run(true) }])} />
    <Button title="Tekrar okutarak doğrula" secondary disabled={busy} onPress={() => void run(false)} />
    {busy && <Button title="İşlemi durdur" secondary onPress={() => { controller.current?.abort(); void nfcManager.cancelScan(); }} />}
  </ManagementDetailsSheet>;
}
