import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShowsDbService, Show } from '../core/shows-db.service';
import { PinModalComponent } from '../shared/pin-modal.component';
import { PinService } from '../core/pin.service';

@Component({
  selector: 'app-admin-shows',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PinModalComponent],
  template: `
    <!-- PIN Modal -->
    <app-pin-modal
      *ngIf="showPinModal"
      mode="verify"
      actionLabel="Shows verwalten"
      (success)="onPinSuccess()"
      (dismissed)="onPinDismissed()"
    />

    <!-- Gesperrte Ansicht -->
    <div class="locked-screen" *ngIf="!unlocked">
      <div class="lock-icon">🔒</div>
      <p class="lock-text">Shows verwalten — gesperrt</p>
    </div>

    <!-- Hauptansicht -->
    <div class="page" *ngIf="unlocked">

      <!-- Topbar -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-logo">POS Show</span>
          <span class="topbar-sep">/</span>
          <span class="topbar-page">Shows verwalten</span>
        </div>
        <div class="topbar-right">
          <button class="btn-nav" routerLink="/pos">← Zur Kasse</button>
          <button class="btn-nav" routerLink="/dashboard">Dashboard</button>
          <button class="btn-nav" routerLink="/admin">Produkte</button>
        </div>
      </header>

      <!-- Inhalt -->
      <main class="content">

        <!-- Neue Show erstellen -->
        <section class="panel">
          <h2 class="panel-title">➕ Neue Show erstellen</h2>
          <div class="form-row">
            <input
              class="input"
              type="text"
              placeholder="Show-Name (z. B. Wien – Kindershow)"
              [(ngModel)]="newName"
              (keyup.enter)="createShow()"
              [disabled]="saving"
            />
            <button
              class="btn-create"
              (click)="createShow()"
              [disabled]="!newName.trim() || saving"
            >
              {{ saving ? 'Speichern…' : 'Erstellen' }}
            </button>
          </div>
          <p class="form-hint" *ngIf="errorMsg" style="color:#ff6b6b">{{ errorMsg }}</p>
          <p class="form-hint" *ngIf="successMsg" style="color:#64dc64">{{ successMsg }}</p>
        </section>

        <!-- Shows Liste -->
        <section class="panel">
          <h2 class="panel-title">🎭 Alle Shows ({{ shows.length }})</h2>

          <div class="empty" *ngIf="shows.length === 0 && !loading">
            Noch keine Shows vorhanden. Erstelle deine erste Show oben.
          </div>
          <div class="loading" *ngIf="loading">Lade Shows…</div>

          <ul class="shows-list" *ngIf="shows.length > 0">
            <li class="show-item" *ngFor="let show of shows">
              <div class="show-info">
                <span class="show-name">{{ show.name }}</span>
                <span class="show-date">Erstellt: {{ formatDate(show.createdAt) }}</span>
              </div>
              <button
                class="btn-delete"
                (click)="confirmDelete(show)"
                title="Show löschen"
              >
                🗑️
              </button>
            </li>
          </ul>
        </section>

      </main>

      <!-- Bestätigungs-Dialog -->
      <div class="overlay" *ngIf="showToDelete">
        <div class="dialog">
          <h3 class="dialog-title">Show löschen?</h3>
          <p class="dialog-text">
            „<strong>{{ showToDelete?.name }}</strong>" wird dauerhaft gelöscht.
            Bestehende Kassenschichten bleiben erhalten.
          </p>
          <div class="dialog-actions">
            <button class="btn-cancel" (click)="cancelDelete()">Abbrechen</button>
            <button class="btn-confirm-delete" (click)="deleteShow()">Löschen</button>
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

    /* ── Locked ── */
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

    /* ── Topbar ── */
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

    /* ── Content ── */
    .content {
      max-width: 680px;
      margin: 0 auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }

    /* ── Panel ── */
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

    /* ── Form ── */
    .form-row {
      display: flex;
      gap: 0.7rem;
      align-items: center;
    }
    .input {
      flex: 1;
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

    .form-hint {
      margin: 0.6rem 0 0;
      font-size: 0.82rem;
    }

    /* ── Shows List ── */
    .shows-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .show-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #12121f;
      border: 1px solid #2a2a4a;
      border-radius: 10px;
      padding: 0.8rem 1rem;
      transition: border-color 0.15s;
    }
    .show-item:hover { border-color: #3a3a6a; }
    .show-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .show-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: #e0e0ff;
    }
    .show-date {
      font-size: 0.75rem;
      color: #555577;
    }
    .btn-delete {
      background: transparent;
      border: 1px solid #3a1a1a;
      color: #cc5555;
      padding: 0.4rem 0.6rem;
      border-radius: 8px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;
    }
    .btn-delete:hover {
      background: rgba(200, 50, 50, 0.15);
      border-color: #cc5555;
    }

    .empty { color: #555577; font-style: italic; padding: 0.5rem 0; font-size: 0.88rem; }
    .loading { color: #7c6fff; font-size: 0.88rem; }

    /* ── Dialog ── */
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
    .dialog-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #e0e0ff;
      margin: 0 0 0.8rem;
    }
    .dialog-text {
      font-size: 0.88rem;
      color: #9999bb;
      margin: 0 0 1.4rem;
      line-height: 1.5;
    }
    .dialog-text strong { color: #e0e0ff; }
    .dialog-actions {
      display: flex;
      gap: 0.7rem;
      justify-content: flex-end;
    }
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
export class AdminShowsComponent implements OnInit {

  unlocked = false;
  showPinModal = false;

  shows: Show[] = [];
  loading = true;
  saving = false;
  newName = '';
  errorMsg = '';
  successMsg = '';
  showToDelete: Show | null = null;

  constructor(
    private showsDb: ShowsDbService,
    private pinService: PinService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const hasPin = await this.pinService.hasPin();
    if (hasPin) {
      this.showPinModal = true;
    } else {
      this.unlocked = true;
      await this.loadShows();
    }
    this.cdr.detectChanges();
  }

  async onPinSuccess() {
    this.showPinModal = false;
    this.unlocked = true;
    await this.loadShows();
    this.cdr.detectChanges();
  }

  onPinDismissed() {
    this.showPinModal = false;
    this.cdr.detectChanges();
  }

  private async loadShows() {
    this.loading = true;
    this.shows = (await this.showsDb.getAllShows())
      .sort((a, b) => b.createdAt - a.createdAt);
    this.loading = false;
    this.cdr.detectChanges();
  }

  async createShow() {
    const name = this.newName.trim();
    if (!name) return;

    if (this.shows.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      this.errorMsg = 'Eine Show mit diesem Namen existiert bereits.';
      this.successMsg = '';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.errorMsg = '';
    this.successMsg = '';

    const show: Show = {
      id: `show_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      createdAt: Date.now(),
    };

    await this.showsDb.saveShow(show);
    this.newName = '';
    this.saving = false;
    this.successMsg = `„${show.name}" wurde erstellt.`;
    await this.loadShows();

    setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
    this.cdr.detectChanges();
  }

  confirmDelete(show: Show) {
    this.showToDelete = show;
    this.cdr.detectChanges();
  }

  cancelDelete() {
    this.showToDelete = null;
    this.cdr.detectChanges();
  }

  async deleteShow() {
    if (!this.showToDelete) return;
    await this.showsDb.deleteShow(this.showToDelete.id);
    this.showToDelete = null;
    await this.loadShows();
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
