"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Where password-reset emails land (via /auth/callback, which exchanges the
// recovery code and signs the user in). Public route under /auth — if the
// recovery session is missing, updateUser fails and we say what to do.
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("session")
          ? "Open the reset link from your email first — it signs you in so you can set a new password."
          : error.message
      );
      return;
    }
    toast.success("Password updated — you're signed in.");
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set a new password
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your reset link signed you in — choose a new password to finish.
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              required
              minLength={8}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full text-sm font-semibold"
          >
            {pending ? "Saving…" : "Save new password"}
          </Button>
        </form>
      </div>
    </main>
  );
}
