import { ActiveContext } from '../types';

let currentPersonaHeaders: Record<string, string> = {
  'x-user-id': 'usr_apex_admin',
  'x-agency-id': 'agency_apex',
  'x-role': 'agency_admin'
};

export function setPersonaContext(headers: Record<string, string>) {
  currentPersonaHeaders = { ...headers };
}

export function getPersonaContext() {
  return currentPersonaHeaders;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...currentPersonaHeaders,
    ...options.headers
  };

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}
