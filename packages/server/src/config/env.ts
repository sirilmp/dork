import 'dotenv/config';

function required(name: string, fallbackForNonProd: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === 'production') {
    // Fail fast rather than booting with an insecure/undefined secret in production.
    throw new Error(`Environment variable ${name} is required in production but was not set.`);
  }
  return fallbackForNonProd;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Base URL used to build links (e.g. invite links) sent in emails/API responses.
  clientUrl: process.env.CLIENT_URL ?? (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim(),
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'ChangeMe123!',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? '',
  },
};

export const isProduction = env.nodeEnv === 'production';
