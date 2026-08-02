const authUrl = (import.meta.env.VITE_NEON_AUTH_URL || "").replace(/\/$/, "");

async function authRequest(path, { method = "GET", body } = {}) {
  if (!authUrl) return { data: null, error: { message: "Neon Auth is not configured." } };

  try {
    const response = await fetch(`${authUrl}/${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: data?.message || data?.error || `Authentication failed (HTTP ${response.status}).`,
        },
      };
    }

    const token = response.headers.get("set-auth-jwt");
    if (token && data?.session) data.session.token = token;
    return { data, error: null };
  } catch {
    return { data: null, error: { message: "The authentication service could not be reached." } };
  }
}

export const authClient = authUrl ? {
  signIn: {
    email: ({ email, password }) => authRequest("sign-in/email", {
      method: "POST",
      body: { email, password },
    }),
  },
  signUp: {
    email: ({ name, email, password }) => authRequest("sign-up/email", {
      method: "POST",
      body: { name, email, password },
    }),
  },
  getSession: () => authRequest("get-session"),
  signOut: () => authRequest("sign-out", { method: "POST" }),
} : null;

export const isAuthConfigured = Boolean(authClient);

export async function getSessionWithToken() {
  if (!authClient) return { session: null, token: null };
  const response = await authClient.getSession();
  return {
    session: response?.data ?? null,
    token: response?.data?.session?.token ?? null,
  };
}

export async function apiRequest(path, options = {}) {
  const { token } = await getSessionWithToken();
  if (!token) throw new Error("Sign in is required.");

  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "The request failed.");
  return body;
}
