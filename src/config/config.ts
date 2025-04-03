import { config } from 'dotenv';
import logger from '../utils/logger';

// Load .env file
config();

// Check required environment variables
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// Only show warnings in non-development/test environments
if (missingEnvVars.length > 0 && process.env.NODE_ENV !== 'test') {
  logger.warn(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  logger.info('Please set these variables in your .env file or environment');
}

// Set scopes
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export default {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'dummy-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `http://${process.env.AUTH_HOST || 'localhost'}:${parseInt(process.env.AUTH_PORT || '4153', 10)}/oauth2callback`,
    scopes: SCOPES,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },
  auth: {
    port: parseInt(process.env.AUTH_PORT || '4153', 10),
    host: process.env.AUTH_HOST || 'localhost',
  },
};
