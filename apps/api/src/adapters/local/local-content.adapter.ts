import { Injectable } from '@nestjs/common';
import type { ContentProvider } from '../contracts';

@Injectable()
export class LocalContentAdapter implements ContentProvider {
  async getDocument(key: string, locale: 'it' | 'en'): Promise<Record<string, unknown> | null> {
    return {
      key,
      locale,
      source: 'local',
      title: locale === 'it' ? 'PortfolioHub' : 'PortfolioHub',
      updatedAt: '2026-07-31T00:00:00.000Z',
    };
  }
}
