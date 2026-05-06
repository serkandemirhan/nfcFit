import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { completeTaskFromNfc, createCard, NfcScanTask, verifyNfcScan } from '@/lib/api';
import { nfcManager, NFCTag } from '@/lib/nfc-manager';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

export default function NFCScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const surface = getSurfaceColors(colorScheme);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [nfcEnabled, setNfcEnabled] = useState<boolean | null>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scannedTag, setScannedTag] = useState<NFCTag | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [cardName, setCardName] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualUid, setManualUid] = useState('');
  const [manualName, setManualName] = useState('');
  const [matchedTasks, setMatchedTasks] = useState<NfcScanTask[]>([]);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [lastVerifiedTag, setLastVerifiedTag] = useState<NFCTag | null>(null);

  useEffect(() => {
    checkNFCStatus();
  }, []);

  const checkNFCStatus = async () => {
    const supported = await nfcManager.init();
    setNfcSupported(supported);

    if (supported) {
      const enabled = await nfcManager.checkEnabled();
      setNfcEnabled(enabled);
    }
  };

  const createCardMutation = useMutation({
    mutationFn: (data: { uid: string; alias?: string }) => createCard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      Alert.alert(
        t('nfc.scanSuccess'),
        t('cards.addCard') + ' ' + t('common.save'),
        [
          {
            text: t('cards.title'),
            onPress: () => router.push('/(drawer)/cards'),
          },
          { text: t('common.close'), style: 'cancel' },
        ]
      );
      resetScan();
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('tasks.errors.unknownError'));
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: (task: NfcScanTask) => {
      if (!lastVerifiedTag) {
        throw new Error('No verified NFC tag is available');
      }
      return completeTaskFromNfc({
        taskId: task.task_id,
        uid: lastVerifiedTag.id,
        secretcode: lastVerifiedTag.textPayload,
        userid: user?.id === 'admin' ? null : user?.id,
        notes: completionNotes[task.task_id] ?? null,
      });
    },
    onSuccess: (_data, completedTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setMatchedTasks((current) => current.filter((task) => task.task_id !== completedTask.task_id));
      Alert.alert('Success', 'Task completed from NFC scan');
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('tasks.errors.unknownError'));
    },
  });

  const startScan = async () => {
    if (!nfcEnabled) {
      Alert.alert(
        t('nfc.nfcDisabled'),
        t('nfc.nfcDisabled'),
        [
          {
            text: t('settings.title'),
            onPress: () => nfcManager.openSettings(),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
      return;
    }

    setScanState('scanning');

    try {
      const tag = await nfcManager.readTag();

      if (tag) {
        setScannedTag(tag);
        setLastVerifiedTag(tag);
        const tasks = await verifyNfcScan({
          uid: tag.id,
          secretcode: tag.textPayload,
          userid: user?.id === 'admin' ? null : user?.id,
        });
        setMatchedTasks(tasks);
        setScanState('success');
        if (tasks.length === 0) {
          Alert.alert(
            t('nfc.scanSuccess'),
            'Card was read, but no active task matched this card and user. You can save it as a new card if it is not registered.',
            [
              { text: t('cards.addCard'), onPress: () => setShowNameModal(true) },
              { text: t('common.close'), style: 'cancel' },
            ]
          );
        }
      } else {
        setScanState('error');
        Alert.alert(t('common.error'), t('nfc.scanError'));
      }
    } catch (error) {
      setScanState('error');
      console.error('NFC scan error:', error);
      Alert.alert(t('common.error'), t('nfc.scanError'));
    }
  };

  const cancelScan = () => {
    nfcManager.cancelScan();
    setScanState('idle');
  };

  const resetScan = () => {
    setScannedTag(null);
    setLastVerifiedTag(null);
    setMatchedTasks([]);
    setCompletionNotes({});
    setCardName('');
    setScanState('idle');
    setShowNameModal(false);
  };

  const saveCard = () => {
    if (!scannedTag) return;

    createCardMutation.mutate({
      uid: scannedTag.id,
      alias: cardName.trim() || undefined,
    });

    setShowNameModal(false);
  };

  const saveManualCard = () => {
    if (!manualUid.trim()) {
      Alert.alert(t('common.error'), t('cards.errors.cardIdRequired'));
      return;
    }

    createCardMutation.mutate({
      uid: manualUid.trim(),
      alias: manualName.trim() || undefined,
    });

    setManualUid('');
    setManualName('');
    setShowManualModal(false);
  };

  // NFC not supported
  if (nfcSupported === false) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
        <View style={styles.centered}>
          <Ionicons name="phone-portrait-outline" size={80} color={surface.mutedText} />
          <ThemedText type="title">{t('nfc.noNfcSupport')}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: surface.mutedText }]}>
            {t('nfc.noNfcSupport')}
          </ThemedText>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#2563eb' }]}
            onPress={() => setShowManualModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <ThemedText style={styles.buttonText}>{t('cards.addCard')} (Manual)</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // Loading NFC status
  if (nfcSupported === null) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
        <View style={styles.centered}>
          <ThemedText>{t('common.loading')}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <View style={styles.headerRow}>
            <Ionicons name="radio-outline" size={32} color="#2563eb" />
            <View style={styles.headerText}>
              <ThemedText type="subtitle">{t('nfc.title')}</ThemedText>
              <ThemedText style={[styles.hint, { color: surface.mutedText }]}>
                {nfcEnabled ? t('nfc.instructions') : t('nfc.nfcDisabled')}
              </ThemedText>
            </View>
          </View>

          {!nfcEnabled && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#f59e0b' }]}
              onPress={() => nfcManager.openSettings()}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
              <ThemedText style={styles.buttonText}>{t('settings.title')}</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Scan Status */}
        {scanState !== 'idle' && (
          <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.border }]}>
            <ScanStatus state={scanState} surfaceMuted={surface.mutedText} />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          {scanState === 'idle' ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={startScan}
                disabled={!nfcEnabled}
                activeOpacity={0.7}
              >
                <Ionicons name="scan-outline" size={24} color="#fff" />
                <ThemedText style={styles.buttonText}>{t('nfc.readCard')}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, { borderColor: surface.border }]}
                onPress={() => setShowManualModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={24} color="#2563eb" />
                <ThemedText style={styles.secondaryButtonText}>Manual</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={cancelScan}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={24} color="#fff" />
              <ThemedText style={styles.buttonText}>{t('common.cancel')}</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Cards */}
        {matchedTasks.length > 0 && (
          <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.border }]}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#10b981" />
              <View style={styles.headerText}>
                <ThemedText type="subtitle">{matchedTasks[0].location_name}</ThemedText>
                <ThemedText style={[styles.hint, { color: surface.mutedText }]}>
                  {matchedTasks[0].card_alias || matchedTasks[0].card_id} · {matchedTasks.length} active task(s)
                </ThemedText>
              </View>
            </View>

            {matchedTasks.map((task) => (
              <View key={task.task_id} style={[styles.taskResult, { borderColor: surface.border }]}>
                <ThemedText style={styles.taskTitle}>{task.title}</ThemedText>
                {task.description ? (
                  <ThemedText style={[styles.hint, { color: surface.mutedText }]}>{task.description}</ThemedText>
                ) : null}
                <TextInput
                  style={[styles.input, { borderColor: surface.border, color: surface.text }]}
                  placeholder="Completion notes"
                  placeholderTextColor={surface.mutedText}
                  value={completionNotes[task.task_id] ?? ''}
                  onChangeText={(text) => setCompletionNotes((current) => ({ ...current, [task.task_id]: text }))}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.button, styles.completeButton]}
                  onPress={() => completeTaskMutation.mutate(task)}
                  disabled={completeTaskMutation.isPending}
                  activeOpacity={0.7}
                >
                  {completeTaskMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                      <ThemedText style={styles.buttonText}>Complete with NFC</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoGrid}>
          <InfoCard
            icon="card-outline"
            title={t('cards.title')}
            description={t('cards.noCards')}
            onPress={() => router.push('/(drawer)/cards')}
          />
          <InfoCard
            icon="help-circle-outline"
            title={t('settings.about')}
            description={t('nfc.instructions')}
          />
        </View>
      </ScrollView>

      {/* Name Input Modal */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNameModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">{t('cards.cardName')}</ThemedText>
              <TouchableOpacity onPress={() => setShowNameModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {scannedTag && (
              <View style={styles.tagInfo}>
                <ThemedText style={styles.label}>{t('nfc.cardId')}</ThemedText>
                <ThemedText style={styles.tagId}>{scannedTag.id}</ThemedText>
                <ThemedText style={[styles.hint, { color: surface.mutedText }]}>
                  {t('nfc.cardType')}: {scannedTag.type}
                </ThemedText>
              </View>
            )}

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>{t('cards.cardName')} ({t('common.none')})</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: surface.border, color: surface.text }]}
                placeholder={`${t('cards.cardName')}...`}
                placeholderTextColor={surface.mutedText}
                value={cardName}
                onChangeText={setCardName}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowNameModal(false)}
              >
                <ThemedText style={styles.cancelButtonText}>{t('common.cancel')}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveCard}
                disabled={createCardMutation.isPending}
              >
                <ThemedText style={styles.buttonText}>
                  {createCardMutation.isPending ? t('common.loading') : t('common.save')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Manual Card Modal */}
      <Modal
        visible={showManualModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowManualModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">{t('cards.addCard')} (Manual)</ThemedText>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>{t('nfc.cardId')} *</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: surface.border, color: surface.text }]}
                placeholder="ABC123DEF456"
                placeholderTextColor={surface.mutedText}
                value={manualUid}
                onChangeText={setManualUid}
                autoCapitalize="characters"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>{t('cards.cardName')} ({t('common.none')})</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: surface.border, color: surface.text }]}
                placeholder={`${t('cards.cardName')}...`}
                placeholderTextColor={surface.mutedText}
                value={manualName}
                onChangeText={setManualName}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowManualModal(false)}
              >
                <ThemedText style={styles.cancelButtonText}>{t('common.cancel')}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveManualCard}
                disabled={createCardMutation.isPending}
              >
                <ThemedText style={styles.buttonText}>
                  {createCardMutation.isPending ? t('common.loading') : t('common.save')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function ScanStatus({ state, surfaceMuted }: { state: ScanState; surfaceMuted: string }) {
  const { t } = useTranslation();

  if (state === 'scanning') {
    return (
      <View style={styles.scanningIndicator}>
        <Ionicons name="radio" size={48} color="#2563eb" />
        <ThemedText type="subtitle">{t('nfc.scanning')}</ThemedText>
        <ThemedText style={[styles.hint, { color: surfaceMuted }]}>
          {t('nfc.instructions')}
        </ThemedText>
      </View>
    );
  }

  if (state === 'success') {
    return (
      <View style={styles.scanningIndicator}>
        <Ionicons name="checkmark-circle" size={48} color="#10b981" />
        <ThemedText type="subtitle">{t('nfc.scanSuccess')}</ThemedText>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.scanningIndicator}>
        <Ionicons name="close-circle" size={48} color="#ef4444" />
        <ThemedText type="subtitle">{t('nfc.scanError')}</ThemedText>
      </View>
    );
  }

  return null;
}

function InfoCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress?: () => void;
}) {
  const surface = getSurfaceColors(useColorScheme());

  return (
    <TouchableOpacity
      style={[styles.infoCard, { backgroundColor: surface.card, borderColor: surface.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Ionicons name={icon} size={32} color="#2563eb" />
      <ThemedText style={styles.infoTitle}>{title}</ThemedText>
      <ThemedText style={[styles.infoDescription, { color: surface.mutedText }]} numberOfLines={2}>
        {description}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  hint: {
    fontSize: 13,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '600',
  },
  scanningIndicator: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagInfo: {
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    gap: 4,
  },
  tagId: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputGroup: {
    gap: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskResult: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 10,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  completeButton: {
    backgroundColor: '#16a34a',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
});
