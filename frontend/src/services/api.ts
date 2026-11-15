import { fetchAuthSession } from 'aws-amplify/auth';
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const session = await fetchAuthSession();
  const accessToken = session.tokens?.accessToken?.toString();
  if (!accessToken) throw new Error('Your session has expired. Please sign in again.');
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export type Photo = { photoId: string; fileName: string; thumbnailUrl?: string; processingStatus: 'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'; createdAt: string };
export type Page<T> = { items: T[]; nextCursor?: string };
export type UploadIntent = { photoId: string; objectKey: string; uploadUrl: string; createdAt: string; headers: Record<string,string> };
