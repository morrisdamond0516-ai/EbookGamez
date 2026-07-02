const TOKEN_KEY = "ebgz_sub_token";
const TOKEN_EMAIL_KEY = "ebgz_sub_verified_email";

export function getSubscriptionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getVerifiedEmail(): string | null {
  return localStorage.getItem(TOKEN_EMAIL_KEY);
}

export function setSubscriptionAuth(token: string, email: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EMAIL_KEY, email.toLowerCase().trim());
}

export function clearSubscriptionAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EMAIL_KEY);
}

export function isEmailVerified(email: string): boolean {
  const verifiedEmail = getVerifiedEmail();
  const token = getSubscriptionToken();
  return !!token && !!verifiedEmail && verifiedEmail === email.toLowerCase().trim();
}

export function getAuthHeaders(): Record<string, string> {
  const token = getSubscriptionToken();
  if (!token) return {};
  return { "X-Subscription-Token": token };
}

export async function handleAuthError(response: Response): Promise<boolean> {
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    if (data.code === "SESSION_EXPIRED" || data.code === "AUTH_REQUIRED") {
      clearSubscriptionAuth();
      return true;
    }
  }
  return false;
}
