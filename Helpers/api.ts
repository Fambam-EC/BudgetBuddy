import { storage } from './storage';

export const apiUrl = 'https://api.budgetbuddy.me';
export const authTokenKey = '@auth_token_key';

export function apiHeaders(includeJsonContentType = false): Record<string, string> {
	const token = storage.getString(authTokenKey);
	return {
		Accept: 'application/json',
		...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}