import { Injectable } from '@angular/core';

export type StoredOrder = {
  id: string;
  items: any[];       // later we type this as Product[]
  totalCents: number;
  timestamp: number;
};

@Injectable({ providedIn: 'root' })
export class OrdersDbService {
  private readonly DB_NAME = 'pos_show_db';
  private readonly DB_VERSION = 1;
  private readonly STORE = 'orders';

  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async addOrder(order: StoredOrder): Promise<void> {
    const db = await this.getDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(order);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllOrders(): Promise<StoredOrder[]> {
    const db = await this.getDb();

    return await new Promise<StoredOrder[]>((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredOrder[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async clearOrders(): Promise<void> {
    const db = await this.getDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}