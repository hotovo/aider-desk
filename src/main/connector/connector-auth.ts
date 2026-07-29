import { randomBytes } from 'crypto';

export const CONNECTOR_TOKEN = randomBytes(32).toString('hex');
