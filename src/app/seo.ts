import { DOCUMENT } from '@angular/common';
import { inject, Injectable, makeStateKey, REQUEST_CONTEXT, TransferState } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { DefaultTitleStrategy, RouterStateSnapshot } from '@angular/router';

export interface SiteRequestContext {
  siteOrigin?: string;
  apiOrigin: string;
}

const siteOriginKey = makeStateKey<string>('siteOrigin');

@Injectable()
export class SiteTitleStrategy extends DefaultTitleStrategy {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly state = inject(TransferState);
  private readonly context = inject(REQUEST_CONTEXT) as SiteRequestContext | null;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    super.updateTitle(snapshot);

    const route = snapshot.root.firstChild;
    const description: string | undefined = route?.data['description'];
    const path = route?.routeConfig?.path;
    const title = this.buildTitle(snapshot);
    const origin = this.context?.siteOrigin ?? this.state.get(siteOriginKey, '');
    if (this.context?.siteOrigin) {
      this.state.set(siteOriginKey, this.context.siteOrigin);
    }

    const organization = this.document.head.querySelector('#organization-schema');
    if (path === '' && origin) {
      const script = organization ?? this.document.createElement('script');
      script.id = 'organization-schema';
      script.setAttribute('type', 'application/ld+json');
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Громадська організація «Інноваційна дія»',
        url: new URL('/', origin).href,
        logo: new URL('/assets/logo.webp', origin).href,
        sameAs: [
          'https://www.instagram.com/innovatsiyna.diya.vn/',
          'https://www.facebook.com/innovation.action.Vinnitsa/',
        ],
      });
      if (!organization) {
        this.document.head.appendChild(script);
      }
    } else {
      organization?.remove();
    }

    const canonical = this.document.head.querySelector('link[rel="canonical"]');
    if (!description || path === undefined || !title) {
      canonical?.remove();
      this.meta.removeTag('name="description"');
      for (const property of [
        'title',
        'description',
        'type',
        'site_name',
        'locale',
        'url',
        'image',
      ]) {
        this.meta.removeTag(`property="og:${property}"`);
      }
      return;
    }

    this.meta.updateTag({ name: 'description', content: description });
    for (const [property, content] of Object.entries({
      title,
      description,
      type: 'website',
      site_name: 'Інноваційна дія',
      locale: 'uk_UA',
    })) {
      this.meta.updateTag({ property: `og:${property}`, content });
    }

    if (origin) {
      const url = new URL(`/${path}`, origin).href;
      const link = canonical ?? this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', url);
      if (!canonical) {
        this.document.head.appendChild(link);
      }
      this.meta.updateTag({ property: 'og:url', content: url });
      this.meta.updateTag({
        property: 'og:image',
        content: new URL('/assets/home-page-art.webp', origin).href,
      });
    }
  }
}
