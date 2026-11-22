import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly http = inject(HttpClient);
  protected readonly contactStatus = signal<
    'idle' | 'sending' | 'sent' | 'invalid' | 'limited' | 'error'
  >('idle');

  protected async submitContact(event: Event, form: HTMLFormElement): Promise<void> {
    event.preventDefault();
    if (this.contactStatus() === 'sending') return;

    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    if (!name || !email || !message) {
      this.contactStatus.set('invalid');
      return;
    }

    this.contactStatus.set('sending');
    try {
      await firstValueFrom(
        this.http.post('/api/contact', { name, email, message }, { timeout: 12000 }),
      );
      form.reset();
      this.contactStatus.set('sent');
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.contactStatus.set(status === 400 ? 'invalid' : status === 429 ? 'limited' : 'error');
    }
  }
}
