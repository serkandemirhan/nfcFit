import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { createCard, ExerciseLogResult, logExerciseFromNfc } from '@/lib/api';
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
  const [loggedExercise, setLoggedExercise] = useState<ExerciseLogResult | null>(null);

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
    mutationFn: (data: { uid: string; alias?: string; ndefPayload?: string | null; assignedUserId?: string | null }) => createCard(data),
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
        const result = await logExerciseFromNfc({
          uid: tag.id,
          ndefPayload: tag.textPayload,
          userId: user?.id ?? '',
        });
        setLoggedExercise(result);
        setScanState('success');
        queryClient.invalidateQueries({ queryKey: ['exercise_logs'] });
        queryClient.invalidateQueries({ queryKey: ['wellness_logs'] });
        queryClient.invalidateQueries({ queryKey: ['daily_goal_progress'] });
        queryClient.invalidateQueries({ queryKey: ['cards'] });

        if (result?.result === 'logged' || result?.result === 'wellness_logged') {
          return;
        } else if (result?.result === 'new_tag') {
          Alert.alert('Yeni kart eklendi', 'Bu NFC tag hesabına eklendi. Kartlar ekranından fitness veya wellness aksiyonuna bağlayabilirsin.', [
            { text: 'Kartlar', onPress: () => { resetScan(); router.push('/(drawer)/cards' as never); } },
            { text: t('common.close'), style: 'cancel', onPress: resetScan },
          ]);
        } else if (result?.result === 'unassigned_tag') {
          Alert.alert('Kart hazır', 'Bu tag henüz bir aksiyona bağlı değil. Kartlar ekranından bağlayabilirsin.', [
            { text: 'Kartlar', onPress: () => { resetScan(); router.push('/(drawer)/cards' as never); } },
            { text: t('common.close'), style: 'cancel', onPress: resetScan },
          ]);
        } else if (result?.result === 'inactive_tag') {
          Alert.alert(t('common.error'), t('nfc.inactiveExerciseTag'), [{ text: t('common.close'), onPress: resetScan }]);
        } else if (result?.result === 'user_mismatch') {
          Alert.alert(t('common.error'), t('nfc.userMismatch'), [{ text: t('common.close'), onPress: resetScan }]);
        } else {
          Alert.alert(
            t('nfc.scanSuccess'),
            t('nfc.noExerciseTagMatch'),
            [
              { text: t('cards.addCard'), onPress: () => setShowNameModal(true) },
              { text: t('common.close'), style: 'cancel', onPress: resetScan },
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
    setLoggedExercise(null);
    setCardName('');
    setScanState('idle');
    setShowNameModal(false);
  };

  const saveCard = () => {
    if (!scannedTag) return;

    createCardMutation.mutate({
      uid: scannedTag.id,
      ndefPayload: scannedTag.textPayload,
      alias: cardName.trim() || undefined,
      assignedUserId: user?.id ?? '',
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
      assignedUserId: user?.id ?? '',
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
            style={[styles.button, { backgroundColor: surface.green }]}
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
        <View style={styles.scanHero}>
          <ThemedText style={styles.scanTitle}>Hold your phone{'\n'}near the NFC tag</ThemedText>
          <ThemedText style={[styles.scanStateText, { color: surface.green }]}>{scanState === 'scanning' ? 'Scanning...' : 'Ready to scan'}</ThemedText>
          <View style={styles.radarWrap}>
            <View style={styles.radarRingOuter} />
            <View style={styles.radarRingMiddle} />
            <View style={styles.radarRingInner} />
            <TouchableOpacity
              style={[styles.radarButton, { backgroundColor: surface.green }]}
              onPress={startScan}
              disabled={!nfcEnabled || scanState === 'scanning'}
              activeOpacity={0.75}>
              <Ionicons name="radio" size={48} color="#fff" />
            </TouchableOpacity>
          </View>

          {!nfcEnabled && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: surface.green }]}
              onPress={() => nfcManager.openSettings()}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
              <ThemedText style={styles.buttonText}>{t('settings.title')}</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Scan Status */}
        {scanState === 'error' && (
          <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.border }]}>
            <ScanStatus state={scanState} surfaceMuted={surface.mutedText} accent={surface.green} />
          </View>
        )}

        {/* Action Buttons */}
        {scanState !== 'success' && <View style={styles.actionsRow}>
          {scanState === 'idle' ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: surface.green }]}
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
                <Ionicons name="create-outline" size={22} color={surface.green} />
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
        </View>}

        {/* Info Cards */}
        {(loggedExercise?.result === 'logged' || loggedExercise?.result === 'wellness_logged') && (
          <View style={[styles.successCard, { backgroundColor: surface.card, borderColor: surface.border }]}>
            <View style={styles.confettiDots}>
              {Array.from({ length: 18 }).map((_, index) => <View key={index} style={[styles.dot, dotStyle(index)]} />)}
            </View>
            <View style={[styles.successCircle, { backgroundColor: surface.green }]}>
              <Ionicons name="checkmark" size={58} color="#fff" />
            </View>
            <ThemedText style={styles.successTitle}>Great!</ThemedText>
            <ThemedText style={[styles.successExercise, { color: surface.green }]}>
              +{formatQuantity(loggedExercise.quantity, loggedExercise.unit)} {loggedExercise.result === 'wellness_logged' ? loggedExercise.wellness_name : loggedExercise.exercise_name ?? t('nfc.exercise')}
            </ThemedText>
            <ThemedText style={styles.successTitleSmall}>added</ThemedText>
            <View style={[styles.taskResult, { borderColor: surface.border }]}>
              <ThemedText style={[styles.hint, { color: surface.mutedText }]}>
                {loggedExercise.result === 'wellness_logged' ? 'Logged' : 'Calories Burned'}
              </ThemedText>
              <ThemedText style={styles.taskTitle}>
                {loggedExercise.result === 'wellness_logged'
                  ? formatQuantity(loggedExercise.quantity, loggedExercise.unit)
                  : `${loggedExercise.calorie_estimate ?? 0} kcal`}
              </ThemedText>
              <ThemedText style={[styles.hint, { color: surface.mutedText }]}>
                {loggedExercise.result === 'wellness_logged' ? 'Total Today' : 'Total Today'}
              </ThemedText>
            </View>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: surface.green }]} onPress={() => router.push(loggedExercise.result === 'wellness_logged' ? '/(drawer)/wellness' as never : '/(drawer)/fitness' as never)}>
              <ThemedText style={styles.buttonText}>{loggedExercise.result === 'wellness_logged' ? 'View Wellness' : 'View Workout'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton, { borderColor: surface.border }]} onPress={resetScan}>
              <ThemedText style={styles.secondaryButtonText}>Done</ThemedText>
            </TouchableOpacity>
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
      <AppBottomNav />

      {/* Name Input Modal */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { setShowNameModal(false); resetScan(); }}>
          <Pressable style={[styles.modalContent, { backgroundColor: surface.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">{t('cards.cardName')}</ThemedText>
              <TouchableOpacity onPress={() => { setShowNameModal(false); resetScan(); }}>
                <Ionicons name="close" size={24} color={surface.mutedText} />
              </TouchableOpacity>
            </View>

            {scannedTag && (
              <View style={[styles.tagInfo, { backgroundColor: surface.cardRaised }]}>
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
                style={[styles.modalButton, { backgroundColor: surface.cardRaised }]}
                onPress={() => { setShowNameModal(false); resetScan(); }}
              >
                <ThemedText style={styles.cancelButtonText}>{t('common.cancel')}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: surface.green }]}
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
          <Pressable style={[styles.modalContent, { backgroundColor: surface.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">{t('cards.addCard')} (Manual)</ThemedText>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <Ionicons name="close" size={24} color={surface.mutedText} />
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
                style={[styles.modalButton, { backgroundColor: surface.cardRaised }]}
                onPress={() => setShowManualModal(false)}
              >
                <ThemedText style={styles.cancelButtonText}>{t('common.cancel')}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: surface.green }]}
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

function ScanStatus({ state, surfaceMuted, accent }: { state: ScanState; surfaceMuted: string; accent: string }) {
  const { t } = useTranslation();

  if (state === 'scanning') {
    return (
      <View style={styles.scanningIndicator}>
        <Ionicons name="radio" size={48} color={accent} />
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
        <Ionicons name="checkmark-circle" size={48} color={accent} />
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
      <Ionicons name={icon} size={32} color={surface.green} />
      <ThemedText style={styles.infoTitle}>{title}</ThemedText>
      <ThemedText style={[styles.infoDescription, { color: surface.mutedText }]} numberOfLines={2}>
        {description}
      </ThemedText>
    </TouchableOpacity>
  );
}

function formatQuantity(quantity?: number | null, unit?: string | null) {
  const value = quantity ?? 0;
  if (unit === 'seconds') return `${value} sec`;
  if (unit === 'minutes') return `${value} min`;
  if (unit === 'meters') return `${value} m`;
  if (unit === 'ml') return `${value} ml`;
  if (unit === 'cups') return `${value} cup`;
  if (unit === 'count') return `${value}`;
  return `${value} reps`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: bottomNavHeight + 24,
    gap: 12,
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
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  scanHero: {
    borderRadius: 16,
    padding: 18,
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scanTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  scanStateText: {
    fontSize: 13,
    fontWeight: '800',
  },
  radarWrap: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRingOuter: {
    position: 'absolute',
    width: 202,
    height: 202,
    borderRadius: 101,
    borderWidth: 1,
    borderColor: 'rgba(53,211,83,0.18)',
  },
  radarRingMiddle: {
    position: 'absolute',
    width: 158,
    height: 158,
    borderRadius: 79,
    borderWidth: 1,
    borderColor: 'rgba(53,211,83,0.26)',
  },
  radarRingInner: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: 'rgba(53,211,83,0.36)',
  },
  radarButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  successCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 18,
    gap: 12,
    alignItems: 'center',
  },
  successCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  successTitleSmall: {
    fontSize: 18,
    fontWeight: '800',
  },
  successExercise: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  confettiDots: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    height: 120,
  },
  dot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
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
    minHeight: 44,
    borderRadius: 12,
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
    color: '#35D353',
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
    padding: 14,
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
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontWeight: '600',
  },
});

function dotStyle(index: number) {
  const colors = ['#35D353', '#35D353', '#8EA0B8'];
  return {
    left: 22 + ((index * 37) % 280),
    top: 8 + ((index * 23) % 96),
    backgroundColor: colors[index % colors.length],
  };
}
