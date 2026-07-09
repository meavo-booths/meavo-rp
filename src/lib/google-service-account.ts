/** Parse GOOGLE_SERVICE_ACCOUNT_JSON from env (handles escaped newlines). */
export function parseGoogleServiceAccountJson(raw: string): {
  client_email: string;
  private_key: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is empty");
  }

  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = JSON.parse(trimmed) as {
      client_email?: string;
      private_key?: string;
    };
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON — use a single-line value with \\n in the private key",
    );
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key",
    );
  }

  return {
    client_email: credentials.client_email,
    private_key: credentials.private_key.replace(/\\n/g, "\n"),
  };
}
