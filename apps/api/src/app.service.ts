import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  info(): { service: string; version: string; status: string } {
    return {
      service: 'portfoliohub-api',
      version: 'v1',
      status: 'ready',
    };
  }
}
