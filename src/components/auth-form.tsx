"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const supabase = createClient();

  const [tab, setTab] = useState<"sign-in" | "sign-up">("sign-in");
  const [pending, setPending] = useState(false);
  const [intent, setIntent] = useState<"buy" | "sell">("buy");
  const [confirmationSent, setConfirmationSent] = useState(false);

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
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push(next);
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
      toast.success("Welcome to Hammerbid!");
      router.push(next);
      router.refresh();
    } else {
      // Email confirmation is enabled on the Supabase project.
      setConfirmationSent(true);
    }
  }

  if (confirmationSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent you a confirmation link. Click it, then come back and sign
            in.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome to Hammerbid</CardTitle>
        <CardDescription>
          Sign in or create an account to bid, chat, and sell.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "sign-in" | "sign-up")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sign-in">Sign in</TabsTrigger>
            <TabsTrigger value="sign-up">Sign up</TabsTrigger>
          </TabsList>

          {tab === "sign-in" && (
          <TabsContent value="sign-in">
            <form onSubmit={handleSignIn} className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>
          )}

          {tab === "sign-up" && (
          <TabsContent value="sign-up">
            <form onSubmit={handleSignUp} className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-username">Username</Label>
                <Input
                  id="signup-username"
                  name="username"
                  placeholder="shown on bids and chat"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>I&apos;m here to…</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIntent("buy")}
                    className={cn(
                      "rounded-md border p-3 text-sm text-left transition-colors",
                      intent === "buy"
                        ? "border-sky-400/60 bg-sky-400/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-border/80"
                    )}
                  >
                    <span className="font-medium">Buy</span>
                    <p className="text-xs text-muted-foreground">
                      Bid on listings right away
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntent("sell")}
                    className={cn(
                      "rounded-md border p-3 text-sm text-left transition-colors",
                      intent === "sell"
                        ? "border-sky-400/60 bg-sky-400/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-border/80"
                    )}
                  >
                    <span className="font-medium">Sell</span>
                    <p className="text-xs text-muted-foreground">
                      List products or services
                    </p>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Everyone can bid. You can enable selling later in settings
                  either way.
                </p>
              </div>

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
