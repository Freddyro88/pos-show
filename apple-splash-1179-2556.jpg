import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- ─────────────────────────────────────────
       MODAL ZAHLUNG / WECHSELGELD
       Erscheint nach dem Tippen von KASSIEREN
    ───────────────────────────────────────── -->
    <div class="modal-overlay" (click)="onCancel()">
      <div class="modal-box" (click)="$event.stopPropagation()">

        <!-- Total a cobrar -->
        <div class="modal-total-label">ZU ZAHLEN</div>
        <div class="modal-total">{{ formatEUR(totalCents) }}</div>

        <!-- Botones rápidos de billetes -->
        <div class="quick-btns">
          @for (amount of quickAmounts; track amount) {
            <button class="quick-btn"
              [class.active]="givenCents === amount * 100"
              (click)="setGiven(amount * 100)">
              € {{ amount }}
            </button>
          }
          <!-- Botón exacto -->
          <button class="quick-btn passend"
            [class.active]="givenCents === totalCents"
            (click)="setGiven(totalCents)">
            Passend
          </button>
        </div>

        <!-- Display del monto dado -->
        <div class="given-display">
          <div class="given-label">GEGEBEN</div>
          <div class="given-amount" [class.empty]="givenCents === 0">
            {{ givenCents === 0 ? '€ 0,00' : formatEUR(givenCents) }}
          </div>
        </div>

        <!-- Teclado numérico -->
        <div class="numpad">
          @for (key of keys; track key) {
            <button class="numpad-btn"
              [class.numpad-zero]="key === '0'"
              [class.numpad-del]="key === '⌫'"
              [class.numpad-comma]="key === ','"
              (click)="pressKey(key)">
              {{ key }}
            </button>
          }
        </div>

        <!-- Wechselgeld -->
        <div class="wechselgeld-box" [class.positive]="wechselgeld > 0" [class.negative]="wechselgeld < 0">
          <span class="wg-label">WECHSELGELD</span>
          <span class="wg-amount">
            @if (givenCents === 0) {
              —
            } @else if (wechselgeld < 0) {
              Zu wenig: {{ formatEUR(-wechselgeld) }}
            } @else {
              {{ formatEUR(wechselgeld) }}
            }
          </span>
        </div>

        <!-- Botones confirmar / cancelar -->
        <div class="modal-actions">
          <button class="btn-cancel" (click)="onCancel()">
            ✕ Abbrechen
          </button>
          <button class="btn-confirm"
            [disabled]="givenCents < totalCents"
            (click)="onConfirm()">
            ✓ Kassieren
          </button>
        </div>

      </div>
    </div>
  `,
})
export class PaymentModalComponent {

  // ─── INPUTS ────────────────────────────────────────
  @Input() totalCents: number = 0;

  // ─── OUTPUTS ───────────────────────────────────────
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  // ─── ESTADO del teclado ────────────────────────────
  // String con lo que el vendedor va tecleando
  inputStr: string = '';

  // ─── BOTONES RÁPIDOS — billetes comunes ────────────
  quickAmounts = [5, 10, 20, 50];

  // ─── TECLAS del numpad ─────────────────────────────
  keys = ['1','2','3','4','5','6','7','8','9',',','0','⌫'];

  // ─── MONTO DADO por el cliente en centavos ─────────
  get givenCents(): number {
    if (!this.inputStr) return 0;
    // Convierte "4,60" → 460 centavos
    const normalized = this.inputStr.replace(',', '.');
    const val = parseFloat(normalized);
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }

  // ─── WECHSELGELD — diferencia ──────────────────────
  get wechselgeld(): number {
    return this.givenCents - this.totalCents;
  }

  // ─── TECLADO — presionar tecla ─────────────────────
  pressKey(key: string) {
    if (key === '⌫') {
      // Borra último carácter
      this.inputStr = this.inputStr.slice(0, -1);
      return;
    }
    if (key === ',') {
      // Solo una coma permitida
      if (this.inputStr.includes(',')) return;
      // Máximo 2 decimales — no añadir coma si ya hay 2 decimales
      this.inputStr += ',';
      return;
    }
    // Máximo 2 decimales después de la coma
    if (this.inputStr.includes(',')) {
      const decimals = this.inputStr.split(',')[1];
      if (decimals && decimals.length >= 2) return;
    }
    // Máximo 4 dígitos antes de la coma
    const beforeComma = this.inputStr.split(',')[0];
    if (!this.inputStr.includes(',') && beforeComma.length >= 4) return;

    this.inputStr += key;
  }

  // ─── BOTÓN RÁPIDO — pone monto directo ─────────────
  setGiven(cents: number) {
    const euros = cents / 100;
    // Formatea sin decimales si es entero ej: 10 → "10"
    this.inputStr = Number.isInteger(euros)
      ? euros.toString()
      : euros.toFixed(2).replace('.', ',');
  }

  // ─── CONFIRMAR — cierra modal y guarda venta ───────
  onConfirm() {
    if (this.givenCents < this.totalCents) return;
    this.confirmed.emit();
  }

  // ─── CANCELAR — cierra modal sin guardar ───────────
  onCancel() {
    this.inputStr = '';
    this.cancelled.emit();
  }

  // ─── FORMATO EUROS ─────────────────────────────────
  formatEUR(cents: number): string {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency', currency: 'EUR'
    }).format(cents / 100);
  }
}