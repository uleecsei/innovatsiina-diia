import { ChangeDetectionStrategy, Component } from '@angular/core';
import { loadContentList } from '../../content-list';

interface Project {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly imageUrl?: string;
}

@Component({
  selector: 'app-projects-page',
  templateUrl: './projects.page.html',
  styleUrl: './projects.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage {
  protected readonly content = loadContentList<Project>('/api/projects');
}
