import { Injectable } from '@angular/core';

// ─── MODELO DE TURNO ───────────────────────────────
export type Shift = {
  id: string;
  openedAt: number;
  closedAt: number | null;
  orderIds: string[];
  totalCents: number;
  showId: string;
  showName: string;
};

@Injectable({ providedIn: 'root' })
export class ShiftsDbService {
  private readonly DB_NAME    = 'pos_show_db';
  private readonly DB_VERSION = 3; // ← versión unificada con shows store
  private readonly ORDERS_STORE = 'orders';
  private readonly SHIFTS_STORE = 'shifts';
  private readonly SHOWS_STORE  = 'shows';

  private dbPromise: Promise<IDBDatabase> | null = null;

  // ─── CONEXIÓN A INDEXEDDB ──────────────────────────
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
        // ─── Neuer Store für Shows ─────────────────
        if (!db.objectStoreNames.contains(this.SHOWS_STORE)) {
          db.createObjectStore(this.SHOWS_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror  = () => reject(request.error);
    });
    return this.dbPromise;
  }

  // ─── TURNO SPEICHERN ───────────────────────────────
  async saveShift(shift: Shift): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.SHIFTS_STORE, 'readwrite');
      tx.objectStore(this.SHIFTS_STORE).put(shift);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ─── ALLE TURNOS LADEN ─────────────────────────────
  async getAllShifts(): Promise<Shift[]> {
    const db = await this.getDb();
    return new Promise<Shift[]>((resolve, reject) => {
      const tx  = db.transaction(this.SHIFTS_STORE, 'readonly');
      const req = tx.objectStore(this.SHIFTS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as Shift[]) ?? []);
      req.onerror   = () => reject(req.error);
    });
  }

  // ─── AKTIVEN TURNO LADEN ───────────────────────────
  async getActiveShift(): Promise<Shift | null> {
    const all = await this.getAllShifts();
    return all.find(s => s.closedAt === null) ?? null;
  }
}