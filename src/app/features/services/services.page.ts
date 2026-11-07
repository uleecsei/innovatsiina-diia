import { ChangeDetectionStrategy, Component } from '@angular/core';
import { loadContentList } from '../../content-list';

interface Specialist {
  readonly id: string;
  readonly name: string;
  readonly skill: string;
  readonly email: string;
  readonly portfolioUrl?: string;
}

@Component({
  selector: 'app-services-page',
  templateUrl: './services.page.html',
  styleUrl: './services.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPage {
  protected readonly content = loadContentList<Specialist>('/api/specialists');
}
