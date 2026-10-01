import { storage } from './storage';

export const apiUrl = 'https://onset-theatrics-subway.ngrok-free.dev';
export const authTokenKey = '@auth_token_key';

export function apiHeaders(includeJsonContentType = false): Record<string, string> {
	const token = storage.getString(authTokenKey);
	return {
		Accept: 'application/json',
		...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
		'ngrok-skip-browser-warning': 'true',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}