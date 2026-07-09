import { GoogleSignInButton } from "@/components/google-sign-in-button";

const ERROR_MESSAGES: Record<string, string> = {
  DomainNotAllowed: "Only @meavo.com Google accounts can sign in.",
  AccessDenied: "Sign in was denied. Try again.",
  NoAccess: "You do not have access to Meavo RP. Ask an admin to grant RP tool access.",
  NotInvited: "Your account is not registered in Meavo. Contact an administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorKey = params.error ?? "";
  const errorMessage = ERROR_MESSAGES[errorKey];

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Meavo RP</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in with your Meavo Google account.
          </p>
        </div>
        {errorMessage ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {errorMessage}
          </p>
        ) : null}
        <GoogleSignInButton />
      </div>
    </div>
  );
}
