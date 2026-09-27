export type Permission = 'public' | 'user' | 'operator' | 'agent' | 'treasury' | 'guardian';
export class AccessError extends Error {
  status: number;
  constructor(message: string, status = 403) { super(message); this.status = status; }
}
export function assertOrigin(request: Request, allowedOrigin?: string) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || (origin && origin !== (allowedOrigin ?? new URL(request.url).origin))) {
    throw new AccessError('Cross-origin mutation rejected');
  }
  if (!origin && request.headers.has('cookie')) throw new AccessError('Origin required for cookie-authenticated mutation');
}
export function assertRole(permission: Permission, id: string | null, roles: string[]) {
  if (permission === 'public') return;
  if (!id) throw new AccessError('Authentication required', 401);
  if (permission === 'user') return;
  if (!roles.includes(permission)) throw new AccessError('Insufficient authority');
}
