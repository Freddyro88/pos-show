import { Injectable } from '@angular/core';

// ─── MODELO DE ORDEN ───────────────────────────────
export type StoredOrder = {
  id: string;
  items: any[];       // más adelante tipamos como Product[]
  totalCents: number;
  timestamp: number;
  shiftId?: string;   // ID del turno al que pertenece esta venta
};

@Injectable({ providedIn: 'root' })
export class OrdersDbService {
  private readonly DB_NAME = 'pos_show_db';
  private readonly DB_VERSION = 2; // versión 2 — añadimos store de turnos
  private readonly STORE = 'orders';

  private dbPromise: Promise<IDBDatabase> | null = null;

  // ─── CONEXIÓN A INDEXEDDB ──────────────────────────
  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        // Crea store de órdenes si no existe
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: 'id' });
        }
        // Crea store de turnos si no existe
        if (!db.objectStoreNames.contains('shifts')) {
          db.createObjectStore('shifts', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // ─── GUARDAR ORDEN ─────────────────────────────────
  async addOrder(order: StoredOrder): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(order);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ─── CARGAR TODAS LAS ÓRDENES ──────────────────────
  async getAllOrders(): Promise<StoredOrder[]> {
    const db = await this.getDb();
    return await new Promise<StoredOrder[]>((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredOrder[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── BORRAR TODAS LAS ÓRDENES ──────────────────────
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