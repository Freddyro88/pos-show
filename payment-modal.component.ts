import { Injectable } from '@angular/core';

const PIN_KEY = 'pos_show_pin';

@Injectable({ providedIn: 'root' })
export class PinService {

  hasPin(): Promise<boolean> {
    const pin = localStorage.getItem(PIN_KEY);
    return Promise.resolve(pin !== null && pin.length > 0);
  }

  setPin(pin: string): Promise<void> {
    localStorage.setItem(PIN_KEY, pin);
    return Promise.resolve();
  }

  verifyPin(pin: string): Promise<boolean> {
    const stored = localStorage.getItem(PIN_KEY);
    return Promise.resolve(stored === pin);
  }

  clearPin(): Promise<void> {
    localStorage.removeItem(PIN_KEY);
    return Promise.resolve();
  }
}
