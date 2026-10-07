import { randomBytes } from 'node:crypto';
console.log('TOKEN_KEY=' + randomBytes(32).toString('hex'));
console.log('WEBHOOK_SECRET=' + randomBytes(32).toString('base64url'));
