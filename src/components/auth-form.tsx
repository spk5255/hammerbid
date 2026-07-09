"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  EyeIcon,
  EyeOffIcon,
  GavelIcon,
  Loader2Icon,
  MailCheckIcon,
  StoreIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function PasswordInput({
  id,
  autoComplete,
  hint,
}: {
  id: string;
  autoComplete: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <div className="relative">
        <Input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="h-11 pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? (
            <EyeOffIcon className="size-4" />
          ) : (
            <EyeIcon className="size-4" />
          )}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  );
}

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const supabase = createClient();

  // First-run visitors land on sign-up; returning users arrive via
  // ?tab=sign-in (sign-out button) or switch tabs themselves.
  const [tab, setTab] = useState<"sign-in" | "sign-up">(
    searchParams.get("tab") === "sign-in" ? "sign-in" : "sign-up"
  );
  const [pending, setPending] = useState(false);
  const [intent, setIntent] = useState<"buy" | "sell">("buy");
  const [sentTo, setSentTo] = useState<string | null>(null);

  // A confirmation link that couldn't be exchanged here (e.g. opened in a
  // different browser) lands on /auth?error=confirmation_failed. The email
  // itself is usually confirmed anyway, so point the user at sign-in.
  const errorParam = searchParams.get("error");
  useEffect(() => {
    if (errorParam === "confirmation_failed") {
      setTab("sign-in");
      toast.info(
        "That link couldn't finish here, but your email is likely confirmed — sign in to continue."
      );
    }
  }, [errorParam]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // First sign-in on a brand-new account (e.g. the confirmation link was
    // opened in another browser, so the callback never ran here): show the
    // quick tour once. The tour page sets the localStorage marker.
    const createdAt = data.user ? Date.parse(data.user.created_at) : 0;
    const isFreshAccount = Date.now() - createdAt < 24 * 60 * 60 * 1000;
    const toured = localStorage.getItem("hb_tour_done");
    if (isFreshAccount && !toured) {
      router.push(
        next === "/" ? "/welcome" : `/welcome?next=${encodeURIComponent(next)}`
      );
    } else {
      router.push(next);
    }
    router.refresh();
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
      username: form.get("username"),
      intent,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setPending(true);

    // Friendly pre-check; the DB unique constraint is the real guard.
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", parsed.data.username)
      .maybeSingle();
    if (existing) {
      setPending(false);
      toast.error("That username is taken — try another.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        // Bring the confirmation link back through our callback so brand-new
        // users land on the quick tour.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          username: parsed.data.username,
          is_seller: parsed.data.intent === "sell",
        },
      },
    });
    setPending(false);
    if (error) {
      toast.error(
        error.message.includes("Database error")
          ? "That username may already be taken — try another."
          : error.message
      );
      return;
    }
    if (data.session) {
      toast.success("Welcome to the floor!");
      // New accounts get the quick tour first; their destination rides along.
      router.push(
        next === "/" ? "/welcome" : `/welcome?next=${encodeURIComponent(next)}`
      );
      router.refresh();
    } else {
      // Email confirmation is enabled on the Supabase project.
      setSentTo(parsed.data.email);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-5">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-400/10">
          <MailCheckIcon className="size-6 text-sky-400" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Check your email
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{sentTo}</span>.
            Open it, then come back and sign in.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSentTo(null);
            setTab("sign-in");
          }}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          {tab === "sign-up" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tab === "sign-up"
            ? "Bidding is free — you'll be on the floor in under a minute."
            : "Sign in to pick up where you left off."}
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "sign-in" | "sign-up")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sign-up">Sign up</TabsTrigger>
          <TabsTrigger value="sign-in">Sign in</TabsTrigger>
        </TabsList>

        {tab === "sign-up" && (
          <TabsContent value="sign-up">
            <form onSubmit={handleSignUp} className="flex flex-col gap-4 pt-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-username">Username</Label>
                <Input
                  id="signup-username"
                  name="username"
                  placeholder="e.g. midnight_bidder"
                  autoComplete="username"
                  maxLength={20}
                  required
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Shown on your bids and in chat — 3–20 letters, numbers, or
                  underscores.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">Password</Label>
                <PasswordInput
                  id="signup-password"
                  autoComplete="new-password"
                  hint="At least 8 characters."
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>I&apos;m here to…</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIntent("buy")}
                    aria-pressed={intent === "buy"}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      intent === "buy"
                        ? "border-sky-400/60 bg-sky-400/10"
                        : "border-border hover:border-border/80"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <GavelIcon className="size-3.5 text-sky-400" />
                      Buy
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Bid on live lots right away
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntent("sell")}
                    aria-pressed={intent === "sell"}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      intent === "sell"
                        ? "border-sky-400/60 bg-sky-400/10"
                        : "border-border hover:border-border/80"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <StoreIcon className="size-3.5 text-sky-400" />
                      Sell
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      List products or services
                    </p>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Everyone can bid. You can enable selling later in settings
                  either way.
                </p>
              </div>

              <Button
                type="submit"
                disabled={pending}
                className="h-11 w-full text-sm font-semibold"
              >
                {pending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Creating your account…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          </TabsContent>
        )}

        {tab === "sign-in" && (
          <TabsContent value="sign-in">
            <form onSubmit={handleSignIn} className="flex flex-col gap-4 pt-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signin-password">Password</Label>
                <PasswordInput
                  id="signin-password"
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                disabled={pending}
                className="h-11 w-full text-sm font-semibold"
              >
                {pending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
