import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PinService } from '../core/pin.service';

export type PinMode = 'verify' | 'set';

@Component({
  selector: 'app-pin-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pin-overlay" (click)="onOverlayClick($event)">
      <div class="pin-modal" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="pin-header">
          <div class="pin-icon">🔐</div>
          <h2 class="pin-title">{{ title }}</h2>
          <p class="pin-subtitle">{{ subtitle }}</p>
        </div>

        <!-- Fehler -->
        <div class="pin-error" *ngIf="errorMsg">{{ errorMsg }}</div>

        <!-- PIN Anzeige -->
        <div class="pin-dots">
          <div
            class="pin-dot"
            *ngFor="let i of [0,1,2,3]"
            [class.filled]="input.length > i"
          ></div>
        </div>

        <!-- Zahlenfeld -->
        <div class="pin-grid">
          <button class="pin-btn" *ngFor="let n of [1,2,3,4,5,6,7,8,9]"
            (click)="press(n.toString())">{{ n }}</button>
          <button class="pin-btn pin-btn--ghost" (click)="cancel()">✕</button>
          <button class="pin-btn" (click)="press('0')">0</button>
          <button class="pin-btn pin-btn--confirm" (click)="confirm()">✓</button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .pin-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .pin-modal {
      background: #1a1a2e;
      border: 1px solid #2a2a4a;
      border-radius: 20px;
      padding: 2rem 1.5rem;
      width: 320px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.2rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    }

    .pin-header { text-align: center; }
    .pin-icon { font-size: 2rem; margin-bottom: 0.4rem; }
    .pin-title { margin: 0; font-size: 1.2rem; color: #e0e0ff; font-weight: 700; }
    .pin-subtitle { margin: 0.3rem 0 0; font-size: 0.8rem; color: #888aaa; }

    .pin-error {
      background: rgba(255, 80, 80, 0.15);
      border: 1px solid rgba(255, 80, 80, 0.4);
      color: #ff6b6b;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.82rem;
      text-align: center;
      width: 100%;
    }

    .pin-dots {
      display: flex;
      gap: 1rem;
      margin: 0.4rem 0;
    }

    .pin-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid #555577;
      background: transparent;
      transition: all 0.15s ease;
    }
    .pin-dot.filled {
      background: #7c6fff;
      border-color: #7c6fff;
      box-shadow: 0 0 8px rgba(124,111,255,0.6);
    }

    .pin-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.6rem;
      width: 100%;
    }

    .pin-btn {
      background: #252545;
      border: 1px solid #333355;
      border-radius: 12px;
      color: #e0e0ff;
      font-size: 1.3rem;
      font-weight: 600;
      padding: 1rem;
      cursor: pointer;
      transition: background 0.1s, transform 0.1s;
    }
    .pin-btn:active {
      background: #3a3a66;
      transform: scale(0.94);
    }
    .pin-btn--ghost {
      background: transparent;
      border-color: transparent;
      color: #888aaa;
    }
    .pin-btn--ghost:active { background: rgba(255,255,255,0.05); }

    .pin-btn--confirm {
      background: #7c6fff;
      border-color: #9a8fff;
      color: white;
    }
    .pin-btn--confirm:active { background: #5a4fcc; }
  `],
})
export class PinModalComponent implements OnInit {
  @Input() mode: PinMode = 'verify';
  @Input() actionLabel = '';
  @Output() success = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  input = '';
  errorMsg = '';
  confirmInput = '';
  step: 'enter' | 'confirm' = 'enter';

  constructor(private pinService: PinService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    // Wenn kein PIN gesetzt ist und wir verifizieren wollen → direkt erfolgreich
    if (this.mode === 'verify') {
      const has = await this.pinService.hasPin();
      if (!has) {
        this.success.emit();
      }
    }
  }

  get title(): string {
    if (this.mode === 'set') {
      return this.step === 'enter' ? 'PIN festlegen' : 'PIN bestätigen';
    }
    return this.actionLabel || 'PIN eingeben';
  }

  get subtitle(): string {
    if (this.mode === 'set') {
      return this.step === 'enter'
        ? '4-stelligen PIN eingeben'
        : 'PIN zur Bestätigung wiederholen';
    }
    return '4-stelligen PIN eingeben';
  }

  press(digit: string) {
    if (this.input.length >= 4) return;
    this.input += digit;
    this.errorMsg = '';
    this.cdr.detectChanges();
  }

  async confirm() {
    if (this.input.length < 4) {
      this.errorMsg = 'Bitte 4 Stellen eingeben';
      return;
    }

    if (this.mode === 'set') {
      if (this.step === 'enter') {
        this.confirmInput = this.input;
        this.input = '';
        this.step = 'confirm';
        this.cdr.detectChanges();
        return;
      } else {
        if (this.input !== this.confirmInput) {
          this.errorMsg = 'PINs stimmen nicht überein';
          this.input = '';
          this.step = 'enter';
          this.cdr.detectChanges();
          return;
        }
        await this.pinService.setPin(this.input);
        this.success.emit();
        return;
      }
    }

    // mode === 'verify'
    const ok = await this.pinService.verifyPin(this.input);
    if (ok) {
      this.success.emit();
    } else {
      this.errorMsg = 'Falscher PIN';
      this.input = '';
      this.cdr.detectChanges();
    }
  }

  cancel() {
    this.dismissed.emit();
  }

  onOverlayClick(event: MouseEvent) {
    this.dismissed.emit();
  }
}
