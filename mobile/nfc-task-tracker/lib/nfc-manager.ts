import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Platform } from 'react-native';

export type NFCTag = {
  id: string;
  type: string;
  techTypes: string[];
  ndefMessage?: any[];
  textPayload?: string | null;
};

export class NFCManagerService {
  private static instance: NFCManagerService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): NFCManagerService {
    if (!NFCManagerService.instance) {
      NFCManagerService.instance = new NFCManagerService();
    }
    return NFCManagerService.instance;
  }

  async init(): Promise<boolean> {
    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        return false;
      }

      await NfcManager.start();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('NFC Initialization error:', error);
      return false;
    }
  }

  async checkEnabled(): Promise<boolean> {
    try {
      return await NfcManager.isEnabled();
    } catch (error) {
      console.error('NFC enabled check error:', error);
      return false;
    }
  }

  async openSettings(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await NfcManager.goToNfcSetting();
      }
    } catch (error) {
      console.error('Open NFC settings error:', error);
    }
  }

  async readTag(): Promise<NFCTag | null> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Get tag information
      const tag = await NfcManager.getTag();

      if (!tag) {
        return null;
      }

      // Extract ID from tag
      const tagId = this.getTagId(tag);

      const nfcTag: NFCTag = {
        id: tagId,
        type: tag.type || 'unknown',
        techTypes: tag.techTypes || [],
        ndefMessage: tag.ndefMessage,
        textPayload: this.getTextPayload(tag.ndefMessage),
      };

      return nfcTag;
    } catch (error) {
      console.error('NFC read error:', error);
      throw error;
    } finally {
      // Clean up
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch (e) {
        console.error('Cancel technology error:', e);
      }
    }
  }

  async writeTag(message: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);

      const bytes = Ndef.encodeMessage([Ndef.textRecord(message)]);

      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        return true;
      }

      return false;
    } catch (error) {
      console.error('NFC write error:', error);
      throw error;
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch (e) {
        console.error('Cancel technology error:', e);
      }
    }
  }

  private getTagId(tag: any): string {
    // Try to get ID from different sources
    if (tag.id) {
      return this.bytesToHexString(tag.id);
    }

    // For Android
    if (Platform.OS === 'android' && tag.nfcA?.atqa) {
      return this.bytesToHexString(tag.nfcA.atqa);
    }

    // Fallback to a generated ID based on other properties
    return `nfc_${Date.now()}`;
  }

  private getTextPayload(ndefMessage?: any[]): string | null {
    if (!ndefMessage?.length) return null;

    for (const record of ndefMessage) {
      try {
        if (record?.type && String.fromCharCode(...record.type) === 'T' && record.payload) {
          return Ndef.text.decodePayload(record.payload).trim();
        }
        if (record?.payload) {
          const decoded = Ndef.text.decodePayload(record.payload).trim();
          if (decoded) return decoded;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private bytesToHexString(bytes: number[] | Uint8Array): string {
    if (!bytes || bytes.length === 0) {
      return '';
    }

    return Array.from(bytes)
      .map((byte) => {
        const hex = byte.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
      .toUpperCase();
  }

  cancelScan(): void {
    try {
      NfcManager.cancelTechnologyRequest();
    } catch (error) {
      console.error('Cancel scan error:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
      this.isInitialized = false;
    } catch (error) {
      console.error('NFC cleanup error:', error);
    }
  }
}

export const nfcManager = NFCManagerService.getInstance();
