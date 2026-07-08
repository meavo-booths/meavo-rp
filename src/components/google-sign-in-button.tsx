"use client";

import { signIn } from "next-auth/react";

export function GoogleSignInButton() {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Continue with Google
    </button>
  );
}
