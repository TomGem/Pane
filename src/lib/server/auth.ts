import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
	return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	const [salt, key] = hash.split(':');
	if (!salt || !key) return false;
	const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
	return timingSafeEqual(Buffer.from(key, 'hex'), derived);
}
