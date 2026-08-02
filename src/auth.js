const authUrl = (import.meta.env.VITE_NEON_AUTH_URL || "").replace(/\/$/, "");
let clientPromise;

function getAuthClient() {
  if (!authUrl) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@neondatabase/auth").then(({ createAuthClient }) => (
      createAuthClient(authUrl, {
        fetchOptions: { credentials: "include" },
      })
    ));
  }
  return clientPromise;
}

export const authClient = authUrl
  ? {
      signIn: {
        email: async (payload) => (await getAuthClient()).signIn.email(payload),
      },
      signUp: {
        email: async (payload) => (await getAuthClient()).signUp.email(payload),
      },
      emailOtp: {
        verifyEmail: async (payload) => (await getAuthClient()).emailOtp.verifyEmail(payload),
      },
      sendVerificationEmail: async (payload) => (
        await getAuthClient()
      ).sendVerificationEmail(payload),
      requestPasswordReset: async (payload) => (
        await getAuthClient()
      ).requestPasswordReset(payload),
      resetPassword: async (payload) => (await getAuthClient()).resetPassword(payload),
      getSession: async () => (await getAuthClient()).getSession(),
      token: async () => (await getAuthClient()).token(),
      signOut: async () => (await getAuthClient()).signOut(),
    }
  : null;

export const isAuthConfigured = Boolean(authClient);

export async function getSessionWithToken() {
  if (!authClient) return { session: null, token: null };

  const sessionResponse = await authClient.getSession();
  if (sessionResponse?.error || !sessionResponse?.data?.session || !sessionResponse?.data?.user) {
    return { session: null, token: null };
  }

  const tokenResponse = await authClient.token();
  return {
    session: sessionResponse.data,
    token: tokenResponse?.data?.token ?? null,
  };
}

export function isVerifiedSession(session) {
  return session?.user?.emailVerified === true;
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
