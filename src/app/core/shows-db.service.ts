import { Injectable } from '@angular/core';

export type Show = {
  id: string;
  name: string;
  createdAt: number;
};

@Injectable({ providedIn: 'root' })
export class ShowsDbService {

  private readonly DB_NAME    = 'pos_show_db';
  private readonly DB_VERSION = 3;
  private readonly SHOWS_STORE  = 'shows';
  private readonly ORDERS_STORE = 'orders';
  private readonly SHIFTS_STORE = 'shifts';

  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.ORDERS_STORE)) {
          db.createObjectStore(this.ORDERS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.SHIFTS_STORE)) {
          db.createObjectStore(this.SHIFTS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.SHOWS_STORE)) {
          db.createObjectStore(this.SHOWS_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror   = () => reject(request.error);
    });
    return this.dbPromise;
  }

  async saveShow(show: Show): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.SHOWS_STORE, 'readwrite');
      tx.objectStore(this.SHOWS_STORE).put(show);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async getAllShows(): Promise<Show[]> {
    const db = await this.getDb();
    return new Promise<Show[]>((resolve, reject) => {
      const tx  = db.transaction(this.SHOWS_STORE, 'readonly');
      const req = tx.objectStore(this.SHOWS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as Show[]) ?? []);
      req.onerror   = () => reject(req.error);
    });
  }

  async deleteShow(id: string): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.SHOWS_STORE, 'readwrite');
      tx.objectStore(this.SHOWS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }
}
