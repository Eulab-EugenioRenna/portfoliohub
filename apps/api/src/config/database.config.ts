import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url:
    process.env.DATABASE_URL ??
    'postgresql://portfoliohub:portfoliohub@localhost:5432/portfoliohub',
}));
