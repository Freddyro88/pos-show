import { Injectable } from '@angular/core';

// ─── MODELO DE TURNO ───────────────────────────────
export type Shift = {
  id: string;
  openedAt: number;   // timestamp apertura
  closedAt: number | null;  // null = turno abierto
  orderIds: string[]; // IDs de ventas de este turno
  totalCents: number; // total acumulado del turno
};

@Injectable({ providedIn: 'root' })
export class ShiftsDbService {
  private readonly DB_NAME = 'pos_show_db';
  private readonly DB_VERSION = 2; // subimos versión para añadir store
  private readonly ORDERS_STORE = 'orders';
  private readonly SHIFTS_STORE = 'shifts';

  private dbPromise: Promise<IDBDatabase> | null = null;

  // ─── CONEXIÓN A INDEXEDDB ──────────────────────────
  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        // Crea store de órdenes si no existe
        if (!db.objectStoreNames.contains(this.ORDERS_STORE)) {
          db.createObjectStore(this.ORDERS_STORE, { keyPath: 'id' });
        }
        // Crea store de turnos si no existe
        if (!db.objectStoreNames.contains(this.SHIFTS_STORE)) {
          db.createObjectStore(this.SHIFTS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // ─── GUARDAR TURNO ─────────────────────────────────
  async saveShift(shift: Shift): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.SHIFTS_STORE, 'readwrite');
      tx.objectStore(this.SHIFTS_STORE).put(shift);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ─── CARGAR TODOS LOS TURNOS ───────────────────────
  async getAllShifts(): Promise<Shift[]> {
    const db = await this.getDb();
    return await new Promise<Shift[]>((resolve, reject) => {
      const tx = db.transaction(this.SHIFTS_STORE, 'readonly');
      const req = tx.objectStore(this.SHIFTS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as Shift[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── CARGAR TURNO ACTIVO (sin cerrar) ─────────────
  async getActiveShift(): Promise<Shift | null> {
    const all = await this.getAllShifts();
    return all.find(s => s.closedAt === null) ?? null;
  }
}