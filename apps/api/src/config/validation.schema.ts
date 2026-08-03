import Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  API_PORT: Joi.number().port().default(3000),
  APP_ORIGIN: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  COOKIE_SECURE: Joi.boolean().optional(),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  LOCAL_DATA_PATH: Joi.string().min(1).required(),
  STORAGE_PROVIDER: Joi.string().valid('local', 'aruba').default('local'),
  ARUBA_GATEWAY_URL: Joi.when('STORAGE_PROVIDER', {
    is: 'aruba',
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Joi.when branch key.
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  ARUBA_GATEWAY_KEY_ID: Joi.when('STORAGE_PROVIDER', {
    is: 'aruba',
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Joi.when branch key.
    then: Joi.string().min(8).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  ARUBA_GATEWAY_SECRET: Joi.when('STORAGE_PROVIDER', {
    is: 'aruba',
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Joi.when branch key.
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  UPLOAD_LOCK_TTL_MS: Joi.number().integer().min(10_000).max(300_000).default(30_000),
  FILE_FINALIZE_CONCURRENCY: Joi.number().integer().min(1).max(32).default(4),
  FILE_MAINTENANCE_CONCURRENCY: Joi.number().integer().min(1).max(16).default(2),
  STORAGE_DELETE_BATCH_SIZE: Joi.number().integer().min(1).max(1000).default(250),
  STORAGE_CACHE_MAX_BYTES: Joi.number().integer().min(0).default(42_949_672_960),
  UPLOAD_MAX_ACTIVE_PER_ACCOUNT: Joi.number().integer().min(1).max(1000).default(100),
  UPLOAD_MAX_ACTIVE_PER_IP: Joi.number().integer().min(1).max(1000).default(100),
  FILE_FINALIZE_LEASE_MS: Joi.number().integer().min(15_000).max(600_000).default(60_000),
  OUTBOX_PUBLISHER_ENABLED: Joi.boolean().default(true),
  LOCAL_MASTER_KEY: Joi.string().base64().required(),
  SESSION_PEPPER: Joi.string().min(32).required(),
  BILLING_PROVIDER: Joi.string().valid('local', 'stripe').default('local'),
  STRIPE_SECRET_KEY: Joi.when('BILLING_PROVIDER', {
    is: 'stripe',
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Joi.when branch key.
    then: Joi.string().min(20).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  STRIPE_PUBLISHABLE_KEY: Joi.when('BILLING_PROVIDER', {
    is: 'stripe',
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Joi.when branch key.
    then: Joi.string().min(20).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  STRIPE_WEBHOOK_SECRET: Joi.when('BILLING_PROVIDER', {
    is: 'stripe',
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Joi.when branch key.
    then: Joi.string().min(20).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  STRIPE_PRO_MONTHLY_PRICE_ID: Joi.string().allow('').optional(),
  STRIPE_PRO_ANNUAL_PRICE_ID: Joi.string().allow('').optional(),
  STRIPE_UNLIMITED_MONTHLY_PRICE_ID: Joi.string().allow('').optional(),
  STRIPE_UNLIMITED_ANNUAL_PRICE_ID: Joi.string().allow('').optional(),
}).unknown(true);
