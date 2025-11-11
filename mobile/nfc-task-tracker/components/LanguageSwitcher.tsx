import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLanguage, type Language } from '@/hooks/useLanguage';

type LanguageOption = {
  code: Language;
  name: string;
  flag: string;
};

const languages: LanguageOption[] = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

export function LanguageSwitcher() {
  const { currentLanguage, changeLanguage } = useLanguage();
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  const currentLang = languages.find((lang) => lang.code === currentLanguage);

  const handleLanguageChange = async (language: Language) => {
    await changeLanguage(language);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.flag}>{currentLang?.flag}</Text>
        <Text style={styles.languageName}>{currentLang?.name}</Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.language')}</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  currentLanguage === lang.code && styles.languageOptionActive,
                ]}
                onPress={() => handleLanguageChange(lang.code)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.optionName,
                    currentLanguage === lang.code && styles.optionNameActive,
                  ]}
                >
                  {lang.name}
                </Text>
                {currentLanguage === lang.code && (
                  <Ionicons name="checkmark" size={24} color="#2563eb" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  flag: {
    fontSize: 20,
  },
  languageName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
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
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  languageOptionActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  optionFlag: {
    fontSize: 28,
  },
  optionName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  optionNameActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
