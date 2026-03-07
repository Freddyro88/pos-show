import { Injectable } from '@angular/core';

const DB_NAME = 'pos_show_db';
const DB_VERSION = 3;
const SETTINGS_STORE = 'settings';

@Injectable({ providedIn: 'root' })
export class PinService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
  if (this.dbPromise) return this.dbPromise;
  this.dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // Solo crear stores que no existen
      if (!db.objectStoreNames.contains('orders'))
        db.createObjectStore('orders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('shifts'))
        db.createObjectStore('shifts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SETTINGS_STORE))
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
    };
    req.onblocked = () => {
      console.warn('⚠️ IndexedDB blocked — cerrá otras pestañas');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.error('❌ IndexedDB error:', req.error);
      reject(req.error);
    };
  });
  return this.dbPromise;
}

  private async getSetting(key: string): Promise<string | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const req = tx.objectStore(SETTINGS_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  private async setSetting(key: string, value: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      tx.objectStore(SETTINGS_STORE).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async hasPin(): Promise<boolean> {
    const pin = await this.getSetting('shift_pin');
    return pin !== null && pin.length > 0;
  }

  async setPin(pin: string): Promise<void> {
    await this.setSetting('shift_pin', pin);
  }

  async verifyPin(pin: string): Promise<boolean> {
    const stored = await this.getSetting('shift_pin');
    return stored === pin;
  }

  async clearPin(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      tx.objectStore(SETTINGS_STORE).delete('shift_pin');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
