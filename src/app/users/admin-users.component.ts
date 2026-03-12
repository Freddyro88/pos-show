import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UsersDbService, User } from '../core/users-db.service';
import { PinModalComponent } from '../shared/pin-modal.component';
import { PinService } from '../core/pin.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PinModalComponent],
  template: `
    <!-- PIN Modal -->
    <app-pin-modal
      *ngIf="showPinModal"
      mode="verify"
      actionLabel="Benutzer verwalten"
      (success)="onPinSuccess()"
      (dismissed)="onPinDismissed()"
    />

    <!-- Gesperrte Ansicht -->
    <div class="locked-screen" *ngIf="!unlocked">
      <div class="lock-icon">🔒</div>
      <p class="lock-text">Benutzer verwalten — gesperrt</p>
    </div>

    <!-- Hauptansicht -->
    <div class="page" *ngIf="unlocked">

      <!-- Topbar -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-logo">POS Show</span>
          <span class="topbar-sep">/</span>
          <span class="topbar-page">Benutzer verwalten</span>
        </div>
        <div class="topbar-right">
          <button class="btn-nav" routerLink="/pos">← Zur Kasse</button>
          <button class="btn-nav" routerLink="/dashboard">Dashboard</button>
          <button class="btn-nav" routerLink="/shows">🎭 Shows</button>
          <button class="btn-nav" routerLink="/admin">Produkte</button>
        </div>
      </header>

      <main class="content">

        <!-- Neuen Benutzer erstellen -->
        <section class="panel">
          <h2 class="panel-title">➕ Neuen Benutzer erstellen</h2>
          <div class="form-grid">
            <div class="form-row">
              <input
                class="input"
                type="text"
                placeholder="Name (z. B. Anna)"
                [(ngModel)]="newName"
                [disabled]="saving"
              />
              <input
                class="input input-pin"
                type="password"
                placeholder="PIN (4 Ziffern)"
                [(ngModel)]="newPin"
                maxlength="4"
                inputmode="numeric"
                [disabled]="saving"
              />
              <button
                class="btn-create"
                (click)="createUser()"
                [disabled]="!newName.trim() || newPin.length < 4 || saving"
              >
                {{ saving ? 'Speichern…' : 'Erstellen' }}
              </button>
            </div>
          </div>
          <p class="form-hint" *ngIf="errorMsg" style="color:#ff6b6b">{{ errorMsg }}</p>
          <p class="form-hint" *ngIf="successMsg" style="color:#64dc64">{{ successMsg }}</p>
        </section>

        <!-- Benutzerliste -->
        <section class="panel">
          <h2 class="panel-title">👤 Alle Benutzer ({{ users.length }})</h2>

          <div class="empty" *ngIf="users.length === 0 && !loading">
            Noch keine Benutzer vorhanden.
          </div>
          <div class="loading" *ngIf="loading">Lade Benutzer…</div>

          <ul class="users-list" *ngIf="users.length > 0">
            <li class="user-item" *ngFor="let user of users">
              <div class="user-avatar">{{ user.name.charAt(0).toUpperCase() }}</div>
              <div class="user-info">
                <span class="user-name">{{ user.name }}</span>
                <span class="user-date">Erstellt: {{ formatDate(user.createdAt) }}</span>
              </div>
              <div class="user-actions">
                <button class="btn-change-pin" (click)="startChangePin(user)" title="PIN ändern">
                  🔐
                </button>
                <button class="btn-delete" (click)="confirmDelete(user)" title="Benutzer löschen">
                  🗑️
                </button>
              </div>
            </li>
          </ul>
        </section>

      </main>

      <!-- PIN ändern Dialog -->
      <div class="overlay" *ngIf="userChangingPin">
        <div class="dialog">
          <h3 class="dialog-title">PIN ändern</h3>
          <p class="dialog-text">Neuer PIN für <strong>{{ userChangingPin?.name }}</strong></p>
          <input
            class="input"
            type="password"
            placeholder="Neuer PIN (4 Ziffern)"
            [(ngModel)]="changePinValue"
            maxlength="4"
            inputmode="numeric"
          />
          <p class="form-hint" *ngIf="changePinError" style="color:#ff6b6b; margin-top:0.5rem">{{ changePinError }}</p>
          <div class="dialog-actions" style="margin-top:1rem">
            <button class="btn-cancel" (click)="cancelChangePin()">Abbrechen</button>
            <button class="btn-confirm" (click)="saveNewPin()" [disabled]="changePinValue.length < 4">Speichern</button>
          </div>
        </div>
      </div>

      <!-- Löschen Bestätigung -->
      <div class="overlay" *ngIf="userToDelete">
        <div class="dialog">
          <h3 class="dialog-title">Benutzer löschen?</h3>
          <p class="dialog-text">
            <strong>{{ userToDelete?.name }}</strong> wird dauerhaft gelöscht.
          </p>
          <div class="dialog-actions">
            <button class="btn-cancel" (click)="cancelDelete()">Abbrechen</button>
            <button class="btn-confirm-delete" (click)="deleteUser()">Löschen</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #0f0f1a;
      color: #e0e0ff;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }

    .locked-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 1rem;
    }
    .lock-icon { font-size: 3rem; }
    .lock-text { color: #888aaa; font-size: 1rem; }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #1e1e3a;
      background: #12121f;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .topbar-left { display: flex; align-items: center; gap: 0.5rem; }
    .topbar-logo { font-weight: 800; font-size: 1rem; color: #7c6fff; }
    .topbar-sep { color: #333355; }
    .topbar-page { color: #aaaacc; font-size: 0.9rem; }
    .topbar-right { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .btn-nav {
      background: transparent;
      border: 1px solid #333355;
      color: #aaaacc;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-nav:hover { border-color: #7c6fff; color: #e0e0ff; }

    .content {
      max-width: 680px;
      margin: 0 auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }

    .panel {
      background: #1a1a2e;
      border: 1px solid #2a2a4a;
      border-radius: 14px;
      padding: 1.4rem;
    }
    .panel-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #aaaacc;
      margin: 0 0 1rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .form-row {
      display: flex;
      gap: 0.7rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .input {
      flex: 1;
      min-width: 120px;
      background: #12121f;
      border: 1px solid #333355;
      color: #e0e0ff;
      padding: 0.65rem 0.9rem;
      border-radius: 10px;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.15s;
      -webkit-user-select: text;
      user-select: text;
    }
    .input:focus { border-color: #7c6fff; }
    .input::placeholder { color: #555577; }
    .input:disabled { opacity: 0.5; }
    .input-pin { max-width: 140px; flex: none; letter-spacing: 0.3em; }

    .btn-create {
      background: #7c6fff;
      border: none;
      color: white;
      padding: 0.65rem 1.2rem;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .btn-create:hover:not(:disabled) { background: #6a5fdd; }
    .btn-create:disabled { opacity: 0.4; cursor: not-allowed; }

    .form-hint { margin: 0.6rem 0 0; font-size: 0.82rem; }

    .users-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .user-item {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      background: #12121f;
      border: 1px solid #2a2a4a;
      border-radius: 10px;
      padding: 0.8rem 1rem;
      transition: border-color 0.15s;
    }
    .user-item:hover { border-color: #3a3a6a; }
    .user-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c6fff, #5a4fcc);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: 800;
      color: white;
      flex-shrink: 0;
    }
    .user-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .user-name { font-size: 0.95rem; font-weight: 600; color: #e0e0ff; }
    .user-date { font-size: 0.75rem; color: #555577; }
    .user-actions { display: flex; gap: 0.4rem; }

    .btn-change-pin {
      background: transparent;
      border: 1px solid #2a2a4a;
      color: #aaaacc;
      padding: 0.4rem 0.6rem;
      border-radius: 8px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-change-pin:hover { border-color: #7c6fff; color: #e0e0ff; }

    .btn-delete {
      background: transparent;
      border: 1px solid #3a1a1a;
      color: #cc5555;
      padding: 0.4rem 0.6rem;
      border-radius: 8px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-delete:hover { background: rgba(200,50,50,0.15); border-color: #cc5555; }

    .empty { color: #555577; font-style: italic; padding: 0.5rem 0; font-size: 0.88rem; }
    .loading { color: #7c6fff; font-size: 0.88rem; }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
      padding: 1rem;
    }
    .dialog {
      background: #1a1a2e;
      border: 1px solid #3a3a6a;
      border-radius: 16px;
      padding: 1.8rem;
      max-width: 380px;
      width: 100%;
    }
    .dialog-title { font-size: 1.1rem; font-weight: 700; color: #e0e0ff; margin: 0 0 0.8rem; }
    .dialog-text { font-size: 0.88rem; color: #9999bb; margin: 0 0 1rem; line-height: 1.5; }
    .dialog-text strong { color: #e0e0ff; }
    .dialog-actions { display: flex; gap: 0.7rem; justify-content: flex-end; }

    .btn-cancel {
      background: transparent;
      border: 1px solid #333355;
      color: #aaaacc;
      padding: 0.55rem 1.1rem;
      border-radius: 9px;
      font-size: 0.88rem;
      cursor: pointer;
    }
    .btn-cancel:hover { border-color: #7c6fff; color: #e0e0ff; }

    .btn-confirm {
      background: #7c6fff;
      border: none;
      color: white;
      padding: 0.55rem 1.1rem;
      border-radius: 9px;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-confirm:hover:not(:disabled) { background: #6a5fdd; }
    .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-confirm-delete {
      background: #cc3333;
      border: none;
      color: white;
      padding: 0.55rem 1.1rem;
      border-radius: 9px;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-confirm-delete:hover { background: #aa2222; }
  `],
})
export class AdminUsersComponent implements OnInit {

  unlocked = false;
  showPinModal = false;

  users: User[] = [];
  loading = true;
  saving = false;
  newName = '';
  newPin = '';
  errorMsg = '';
  successMsg = '';

  userToDelete: User | null = null;
  userChangingPin: User | null = null;
  changePinValue = '';
  changePinError = '';

  constructor(
    private usersDb: UsersDbService,
    private pinService: PinService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const hasPin = await this.pinService.hasPin();
    if (hasPin) {
      this.showPinModal = true;
    } else {
      this.unlocked = true;
      await this.loadUsers();
    }
    this.cdr.detectChanges();
  }

  async onPinSuccess() {
    this.showPinModal = false;
    this.unlocked = true;
    await this.loadUsers();
    this.cdr.detectChanges();
  }

  onPinDismissed() {
    this.showPinModal = false;
    this.cdr.detectChanges();
  }

  private async loadUsers() {
    this.loading = true;
    this.users = (await this.usersDb.getAllUsers())
      .sort((a, b) => a.name.localeCompare(b.name));
    this.loading = false;
    this.cdr.detectChanges();
  }

  async createUser() {
    const name = this.newName.trim();
    const pin  = this.newPin.trim();
    if (!name || pin.length < 4) return;

    if (this.users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      this.errorMsg = 'Ein Benutzer mit diesem Namen existiert bereits.';
      this.successMsg = '';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.successMsg = '';

    const user: User = {
      id: crypto.randomUUID(),
      name,
      pin,
      createdAt: Date.now(),
    };

    await this.usersDb.saveUser(user);
    this.newName = '';
    this.newPin = '';
    this.saving = false;
    this.successMsg = `„${user.name}" wurde erstellt.`;
    await this.loadUsers();

    setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
    this.cdr.detectChanges();
  }

  confirmDelete(user: User) {
    this.userToDelete = user;
    this.cdr.detectChanges();
  }

  cancelDelete() {
    this.userToDelete = null;
    this.cdr.detectChanges();
  }

  async deleteUser() {
    if (!this.userToDelete) return;
    await this.usersDb.deleteUser(this.userToDelete.id);
    this.userToDelete = null;
    await this.loadUsers();
  }

  startChangePin(user: User) {
    this.userChangingPin = user;
    this.changePinValue = '';
    this.changePinError = '';
    this.cdr.detectChanges();
  }

  cancelChangePin() {
    this.userChangingPin = null;
    this.changePinValue = '';
    this.cdr.detectChanges();
  }

  async saveNewPin() {
    if (!this.userChangingPin || this.changePinValue.length < 4) return;
    const updated: User = { ...this.userChangingPin, pin: this.changePinValue };
    await this.usersDb.saveUser(updated);
    this.userChangingPin = null;
    this.changePinValue = '';
    await this.loadUsers();
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
