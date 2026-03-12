import { Injectable } from '@angular/core';

export type User = {
  id: string;
  name: string;
  pin: string;       // PIN hasheado como string simple
  createdAt: number;
};

@Injectable({ providedIn: 'root' })
export class UsersDbService {

  private readonly DB_NAME     = 'pos_show_db';
  private readonly DB_VERSION  = 4;
  private readonly USERS_STORE  = 'users';
  private readonly ORDERS_STORE = 'orders';
  private readonly SHIFTS_STORE = 'shifts';
  private readonly SHOWS_STORE  = 'shows';

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
        if (!db.objectStoreNames.contains(this.USERS_STORE)) {
          db.createObjectStore(this.USERS_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror   = () => reject(request.error);
    });
    return this.dbPromise;
  }

  async saveUser(user: User): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.USERS_STORE, 'readwrite');
      tx.objectStore(this.USERS_STORE).put(user);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async getAllUsers(): Promise<User[]> {
    const db = await this.getDb();
    return new Promise<User[]>((resolve, reject) => {
      const tx  = db.transaction(this.USERS_STORE, 'readonly');
      const req = tx.objectStore(this.USERS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as User[]) ?? []);
      req.onerror   = () => reject(req.error);
    });
  }

  async deleteUser(id: string): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.USERS_STORE, 'readwrite');
      tx.objectStore(this.USERS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  verifyPin(user: User, pin: string): boolean {
    return user.pin === pin;
  }
}
