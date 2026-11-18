import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminPage } from './admin.page';

describe('Admin content sections', () => {
  it('switches forms and saves/deletes services and reports through their own endpoints', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminPage);
    http.expectOne('/api/admin/session').flush({ username: 'owner', csrf: 'test-csrf' });
    await Promise.resolve();
    http.expectOne('/api/admin/projects').flush([]);
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const click = (text: string) => {
      const button = [...root.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === text,
      );
      expect(button).toBeTruthy();
      button!.click();
      fixture.detectChanges();
    };
    expect(root.querySelector('h1')?.textContent).toBe('Керування сайтом');
    click('Послуги');
    http
      .expectOne('/api/admin/specialists')
      .flush([{ id: 'service1', name: 'Name', skill: 'Skill', email: 'test@example.com' }]);
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('#name')).toBeTruthy();
    expect(root.querySelector('#title')).toBeNull();
    click('Редагувати');
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    const name = root.querySelector('#name') as HTMLInputElement;
    name.value = 'Updated';
    name.dispatchEvent(new Event('input'));
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    click('Зберегти зміни');
    const update = http.expectOne('/api/admin/specialists/service1');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.name).toBe('Updated');
    expect(update.request.headers.get('X-CSRF-Token')).toBe('test-csrf');
    update.flush({ id: 'service1', name: 'Updated', skill: 'Skill', email: 'test@example.com' });
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    click('Видалити');
    http.expectNone('/api/admin/specialists/service1');
    click('Так, видалити');
    const deletion = http.expectOne('/api/admin/specialists/service1');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null);
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    click('Звітність');
    http
      .expectOne('/api/admin/reports')
      .flush([{ id: 'report1', year: 2025, pdfUrl: '/media/reports/example.pdf' }]);
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('#name')).toBeNull();
    expect(root.querySelector('#year')).toBeTruthy();
    click('Редагувати');
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    const year = root.querySelector('#year') as HTMLInputElement;
    year.value = '2026';
    year.dispatchEvent(new Event('input'));
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    click('Зберегти зміни');
    const report = http.expectOne('/api/admin/reports/report1');
    expect(report.request.body).toEqual({ year: 2026 });
    report.flush({ id: 'report1', year: 2026, pdfUrl: '/media/reports/example.pdf' });
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    click('Проєкти');
    http.expectOne('/api/admin/projects').flush([]);
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('#title')).toBeTruthy();
    expect(root.querySelector('#year')).toBeNull();
    http.verify();
    fixture.destroy();
  });
});
