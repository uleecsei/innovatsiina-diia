import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Project {
  readonly title: string;
  readonly description: string;
}

@Component({
  selector: 'app-projects-page',
  templateUrl: './projects.page.html',
  styleUrl: './projects.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage {
  protected readonly projects: readonly Project[] = [
    {
      title: 'Опитування потреб та рівня захищеності жінок старшого віку',
      description: 'Дослідження у Вінницькій міській територіальній громаді.',
    },
    {
      title: 'Професійна реінтеграція',
      description: 'Навчання та підтримка жінок на шляху до нової професії.',
    },
    {
      title: 'Сильна разом',
      description: 'Групи підтримки, психоедукація та розвиток внутрішньої стійкості.',
    },
    {
      title: 'Активні 60+',
      description: 'Соціалізація, творчі зустрічі та обмін досвідом між поколіннями.',
    },
  ];
}
