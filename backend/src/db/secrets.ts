/** Prints strong values for the two JWT secrets. */
import crypto from 'node:crypto';

const gen = () => crypto.randomBytes(48).toString('base64url');

console.log('\nPaste these into .env, replacing the placeholders:\n');
console.log(`JWT_ACCESS_SECRET=${gen()}`);
console.log(`JWT_REFRESH_SECRET=${gen()}`);
console.log(
  '\nThey must stay different from each other, and must not be committed.\n' +
  'Changing them signs everyone out, which is what you want if they ever leak.\n',
);
