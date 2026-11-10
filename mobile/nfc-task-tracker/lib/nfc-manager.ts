import NfcManager, { NfcTech, Ndef, NdefStatus, TagEvent } from 'react-native-nfc-manager';
import { Platform } from 'react-native';
import { buildTagLink, normalizePhysicalUid } from './tag-link';

export type NFCTag = {
  id: string;
  type: string;
  techTypes: string[];
  ndefMessage?: any[];
  textPayload?: string | null;
};

export type NFCInspection = {
  id: string;
  type: string;
  techTypes: string[];
  ndefStatus: 'read-write' | 'read-only' | 'not-supported' | 'unknown';
  ndefCapacity: number | null;
  records: Array<{ type: string; tnf: number; payloadBytes: number }>;
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

  async readTag(signal?: AbortSignal): Promise<NFCTag | null> {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      if (signal?.aborted) throw new Error('NFC okuma iptal edildi.');
      if (Platform.OS === 'android') {
        // A single session accepts NDEF and blank NFC-A cards; no first-attempt timeout.
        await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA]);
      } else {
        await NfcManager.requestTechnology(NfcTech.Ndef);
      }

      if (signal?.aborted) throw new Error('NFC okuma iptal edildi.');
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
        await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 });
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
        await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 });
      } catch (e) {
        console.error('Cancel technology error:', e);
      }
    }
  }

  async writeAppLink(expectedUid: string, tagId: string, signal?: AbortSignal): Promise<{ url: string; verified: boolean }> {
    const url = buildTagLink(tagId);
    const uid = normalizePhysicalUid(expectedUid);
    if (signal?.aborted) throw new Error('İşlem iptal edildi.');
    if (!this.isInitialized && !(await this.init())) throw new Error('Bu cihazda NFC kullanılamıyor.');
    let written = false;
    try {
      if (signal?.aborted) throw new Error('İşlem iptal edildi.');
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      if (!tag || this.getTagId(tag) !== uid) throw new Error('Farklı kart okutuldu. Hiçbir veri yazılmadı; seçtiğiniz kartı okutun.');
      const status = await NfcManager.ndefHandler.getNdefStatus();
      if (status.status !== NdefStatus.ReadWrite) throw new Error('Kart yazılabilir NDEF desteklemiyor veya salt okunur. Hiçbir veri yazılmadı.');
      const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
      if (!bytes || bytes.length > status.capacity) throw new Error('Kartın kapasitesi bağlantıyı yazmak için yeterli değil.');
      if (signal?.aborted) throw new Error('İşlem iptal edildi.');
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
      written = true;
      const reread = await NfcManager.ndefHandler.getNdefMessage();
      return { url, verified: this.hasAppLink(reread, url) };
    } catch (error) {
      if (written) return { url, verified: false };
      throw error;
    } finally {
      await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 }).catch(() => undefined);
    }
  }

  async verifyAppLink(expectedUid: string, tagId: string, signal?: AbortSignal): Promise<boolean> {
    const uid = normalizePhysicalUid(expectedUid);
    const url = buildTagLink(tagId);
    const tag = await this.readTag(signal);
    if (!tag || tag.id !== uid) throw new Error('Seçili karttan farklı bir kart okutuldu.');
    return this.hasAppLink({ ndefMessage: tag.ndefMessage ?? [] }, url);
  }

  private hasAppLink(tag: Pick<TagEvent, 'ndefMessage'> | null, url: string): boolean {
    const records = tag?.ndefMessage;
    if (!records || records.length !== 1) return false;
    const record = records[0];
    const uriType = typeof record.type === 'string' ? record.type === 'U' : record.type.length === 1 && record.type[0] === 85;
    if (record.tnf !== 1 || !uriType) return false;
    try { return Ndef.uri.decodePayload(new Uint8Array(record.payload)) === url; }
    catch { return false; }
  }

  async inspectTag(): Promise<NFCInspection> {
    if (!this.isInitialized && !(await this.init())) {
      throw new Error('NFC is not available on this device.');
    }

    let tag: Awaited<ReturnType<typeof NfcManager.getTag>> = null;
    let ndefStatus: NFCInspection['ndefStatus'] = 'unknown';
    let ndefCapacity: number | null = null;
    let ndefAvailable = false;
    const errors: unknown[] = [];

    try {
      try {
        await NfcManager.requestTechnology(NfcTech.Ndef);
        ndefAvailable = true;
        tag = await NfcManager.getTag();
        const status = await NfcManager.ndefHandler.getNdefStatus();
        ndefCapacity = status.capacity;
        ndefStatus = status.status === NdefStatus.ReadWrite
          ? 'read-write'
          : status.status === NdefStatus.ReadOnly
            ? 'read-only'
            : 'not-supported';
      } catch (error) {
        errors.push(error);
      } finally {
        await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 }).catch((error: unknown) => {
          console.warn('NFC inspection session cleanup failed:', error);
        });
      }

      if (!tag) {
        try {
          await NfcManager.requestTechnology(NfcTech.NfcA);
          tag = await NfcManager.getTag();
        } catch (error) {
          errors.push(error);
        } finally {
          await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 }).catch((error: unknown) => {
            console.warn('NFC inspection session cleanup failed:', error);
          });
        }
      }

      if (!tag) {
        throw new Error(errors.length ? 'Could not read this tag with NDEF or NFC-A.' : 'No NFC tag was detected.');
      }

      const message = ndefAvailable && Array.isArray(tag.ndefMessage) ? tag.ndefMessage : [];
      return {
        id: this.getTagId(tag),
        type: tag.type || 'unknown',
        techTypes: tag.techTypes || [],
        ndefStatus,
        ndefCapacity,
        records: message.map((record) => ({
          type: this.recordType(record.type),
          tnf: record.tnf,
          payloadBytes: Array.isArray(record.payload) ? record.payload.length : 0,
        })),
      };
    } finally {
      await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 }).catch((error: unknown) => {
        console.warn('NFC inspection session cleanup failed:', error);
      });
    }
  }

  async writeDiagnosticText(value: string): Promise<void> {
    const normalized = value.trim();
    if (!normalized || normalized.length > 200) {
      throw new Error('Test text must contain 1–200 characters.');
    }
    await this.writeNdefRecord(Ndef.textRecord(`NFCFIT:TEST:${normalized}`));
  }

  async writeDiagnosticUrl(value: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new Error('Enter a valid HTTPS URL.');
    }
    if (url.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs can be written to a test card.');
    }
    await this.writeNdefRecord(Ndef.uriRecord(url.toString()));
  }

  async resetDiagnosticTag(): Promise<void> {
    await this.writeNdefRecord(Ndef.textRecord('NFCFIT:RESET'));
  }

  private async writeNdefRecord(record: ReturnType<typeof Ndef.textRecord>): Promise<void> {
    if (!this.isInitialized && !(await this.init())) {
      throw new Error('NFC is not available on this device.');
    }
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const status = await NfcManager.ndefHandler.getNdefStatus();
      if (status.status !== NdefStatus.ReadWrite) {
        throw new Error(status.status === NdefStatus.ReadOnly
          ? 'This tag is read-only and cannot be encoded.'
          : 'This tag does not support writable NDEF. No data was changed.');
      }
      const bytes = Ndef.encodeMessage([record]);
      if (bytes.length > status.capacity) {
        throw new Error(`The test record needs ${bytes.length} bytes, but this tag capacity is ${status.capacity} bytes.`);
      }
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
    } finally {
      await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 }).catch((error: unknown) => {
        console.warn('NFC write session cleanup failed:', error);
      });
    }
  }

  private getTagId(tag: TagEvent): string {
    if (typeof tag.id === 'string' && tag.id.length > 0) {
      return tag.id.replace(/[^a-fA-F0-9]/g, '').toUpperCase() || 'unavailable';
    }
    return 'unavailable';
  }

  private recordType(type: number[] | string): string {
    return typeof type === 'string'
      ? type
      : Array.from(type, (byte) => String.fromCharCode(byte)).join('') || 'unknown';
  }

  private getTextPayload(ndefMessage?: Array<{ type?: number[] | string; payload?: number[] }>): string | null {
    if (!ndefMessage?.length) return null;

    for (const record of ndefMessage) {
      try {
        const type = Array.isArray(record.type)
          ? String.fromCharCode(...record.type)
          : record.type;
        if (type === 'T' && record.payload) {
          return Ndef.text.decodePayload(new Uint8Array(record.payload)).trim();
        }
      } catch (error) {
        console.warn('Unable to decode NFC text record:', error);
      }
    }

    return null;
  }

  async cancelScan(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 });
    } catch (error) {
      console.error('Cancel scan error:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0 });
      this.isInitialized = false;
    } catch (error) {
      console.error('NFC cleanup error:', error);
    }
  }
}

export const nfcManager = NFCManagerService.getInstance();
