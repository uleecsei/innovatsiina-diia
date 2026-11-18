import { ChangeDetectionStrategy, Component, inject, signal, DestroyRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

interface Session {
  username: string;
  csrf: string;
}
type Section = 'projects' | 'specialists' | 'reports';
interface Entry {
  id: string;
  title?: string;
  description?: string;
  name?: string;
  skill?: string;
  email?: string;
  year?: number;
  portfolioUrl?: string;
  pdfUrl?: string;
  imageUrl?: string;
}
@Component({
  selector: 'app-admin-page',
  imports: [FormsModule],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
  private readonly http = inject(HttpClient);
  protected readonly session = signal<Session | null>(null);
  protected readonly checking = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly entries = signal<Entry[]>([]);
  protected readonly loadingEntries = signal(false);
  protected readonly preview = signal('');
  protected readonly section = signal<Section>('projects');
  protected readonly sections: { id: Section; label: string }[] = [
    { id: 'projects', label: 'Проєкти' },
    { id: 'specialists', label: 'Послуги' },
    { id: 'reports', label: 'Звітність' },
  ];
  protected readonly attachment = signal('');
  protected readonly selectedFilename = signal('');
  protected name = '';
  protected skill = '';
  protected email = '';
  protected year = new Date().getFullYear();
  private file?: string | null;
  protected label(entry: Entry) {
    return entry.title ?? entry.name ?? `Звіт ${entry.year}`;
  }
  protected async switchSection(section: Section) {
    if (this.busy() || this.loadingEntries() || section === this.section()) return;
    this.section.set(section);
    this.resetForm();
    this.deleting.set(null);
    this.entries.set([]);
    this.notice.set('');
    await this.loadEntries();
  }
  protected username = '';
  protected password = '';
  protected title = '';
  protected description = '';
  protected readonly editingId = signal<string | null>(null);
  protected readonly deleting = signal<Entry | null>(null);
  private originalImage = '';
  private image?: string | null;

  protected edit(project: Entry, fileInput: HTMLInputElement) {
    this.resetForm(fileInput);
    this.editingId.set(project.id);
    this.title = project.title ?? '';
    this.name = project.name ?? '';
    this.skill = project.skill ?? '';
    this.email = project.email ?? '';
    this.year = project.year ?? new Date().getFullYear();
    this.attachment.set(project.portfolioUrl ?? project.pdfUrl ?? '');
    this.description = project.description ?? '';
    this.originalImage = project.imageUrl ?? '';
    this.preview.set(this.originalImage);
    this.error.set('');
    this.notice.set('');
    this.deleting.set(null);
    document
      .getElementById(
        this.section() === 'projects'
          ? 'title'
          : this.section() === 'specialists'
            ? 'name'
            : 'year',
      )
      ?.focus();
  }
  protected resetForm(fileInput?: HTMLInputElement) {
    this.editingId.set(null);
    this.name = '';
    this.skill = '';
    this.email = '';
    this.year = new Date().getFullYear();
    this.file = undefined;
    this.attachment.set('');
    this.selectedFilename.set('');
    this.title = '';
    this.description = '';
    this.image = undefined;
    this.originalImage = '';
    this.preview.set('');
    if (fileInput) fileInput.value = '';
    const portrait = document.getElementById('portrait') as HTMLInputElement | null;
    if (portrait) portrait.value = '';
  }
  protected removePortrait(fileInput: HTMLInputElement) {
    this.image = null;
    this.preview.set('');
    fileInput.value = '';
  }
  protected removeImage(fileInput: HTMLInputElement) {
    if (this.section() === 'projects') {
      this.image = null;
      this.preview.set('');
    } else {
      this.file = null;
      this.attachment.set('');
      this.selectedFilename.set('');
    }
    fileInput.value = '';
  }
  protected async deleteEntry(fileInput: HTMLInputElement) {
    const project = this.deleting();
    if (!project || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await firstValueFrom(
        this.http.delete(`/api/admin/${this.section()}/${project.id}`, { headers: this.headers() }),
      );
      this.entries.update((items) => items.filter((item) => item.id !== project.id));
      if (this.editingId() === project.id) this.resetForm(fileInput);
      this.deleting.set(null);
      this.notice.set('Запис видалено із сайту.');
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }

  constructor() {
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    inject(DestroyRef).onDestroy(() => meta.removeTag('name="robots"'));
    void this.restore();
  }
  private headers() {
    return { 'X-CSRF-Token': this.session()?.csrf ?? '' };
  }
  private showError(error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 401) this.session.set(null);
    this.error.set(
      error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
        ? error.error.error
        : 'Не вдалося з’єднатися із сервером. Спробуйте ще раз.',
    );
  }
  private async restore() {
    try {
      this.session.set(await firstValueFrom(this.http.get<Session>('/api/admin/session')));
      await this.loadEntries();
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) this.showError(error);
    } finally {
      this.checking.set(false);
    }
  }
  protected async login() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      this.session.set(
        await firstValueFrom(
          this.http.post<Session>('/api/admin/login', {
            username: this.username,
            password: this.password,
          }),
        ),
      );
      this.password = '';
      await this.loadEntries();
    } catch (error) {
      this.showError(error);
      this.password = '';
    } finally {
      this.busy.set(false);
    }
  }
  protected async logout() {
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post('/api/admin/logout', {}, { headers: this.headers() }));
      this.session.set(null);
      this.resetForm();
      this.deleting.set(null);
      this.entries.set([]);
      this.notice.set('');
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }
  protected async loadEntries() {
    this.loadingEntries.set(true);
    this.error.set('');
    try {
      this.entries.set(
        await firstValueFrom(this.http.get<Entry[]>(`/api/admin/${this.section()}`)),
      );
    } catch (error) {
      this.showError(error);
    } finally {
      this.loadingEntries.set(false);
    }
  }
  protected async selectImage(event: Event, portrait = false) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.error.set('');
    if (!file) return;
    if (
      this.section() === 'projects' || portrait
        ? file.size > 5 * 1024 * 1024 ||
          !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)
        : file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf')
    ) {
      this.error.set(
        this.section() === 'projects' || portrait
          ? 'Оберіть JPG, PNG, WebP або AVIF до 5 МБ.'
          : 'Оберіть PDF до 10 МБ.',
      );
      input.value = '';
      return;
    }
    this.busy.set(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Read failed'));
        reader.readAsDataURL(file);
      });
      if (this.section() === 'projects' || portrait) {
        this.image = data.slice(data.indexOf(',') + 1);
        this.preview.set(data);
      } else {
        this.file = data.slice(data.indexOf(',') + 1);
        this.selectedFilename.set(file.name);
      }
    } catch {
      this.error.set('Не вдалося прочитати файл.');
      input.value = '';
    } finally {
      this.busy.set(false);
    }
  }
  protected async save(fileInput: HTMLInputElement) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const editingId = this.editingId();
      const project = await firstValueFrom(
        this.http.request<Entry>(
          editingId ? 'PUT' : 'POST',
          `/api/admin/${this.section()}${editingId ? '/' + editingId : ''}`,
          {
            body:
              this.section() === 'projects'
                ? {
                    title: this.title,
                    description: this.description,
                    ...(this.image !== undefined ? { image: this.image } : {}),
                  }
                : {
                    ...(this.section() === 'specialists'
                      ? {
                          name: this.name,
                          skill: this.skill,
                          email: this.email,
                          ...(this.image !== undefined ? { image: this.image } : {}),
                        }
                      : { year: this.year }),
                    ...(this.file !== undefined ? { file: this.file } : {}),
                  },
            headers: this.headers(),
          },
        ),
      );
      this.entries.update((items) =>
        editingId
          ? items.map((item) => (item.id === editingId ? project : item))
          : [...items, project],
      );
      if (this.section() === 'reports')
        this.entries.update((items) => [...items].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)));
      this.resetForm(fileInput);
      this.notice.set(editingId ? 'Зміни збережено на сайті.' : 'Запис опубліковано на сайті.');
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }
}
