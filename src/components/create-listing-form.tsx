"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createListing } from "@/app/create/actions";
import {
  LISTING_CATEGORIES,
  MAX_LISTING_DAYS,
  MIN_LISTING_MINUTES,
} from "@/lib/constants";
import { listingSchema } from "@/lib/validation/listing";
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
import { Textarea } from "@/components/ui/textarea";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover";

export function CreateListingForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // default end: 7 days out, in the user's local time. The clock is read in
  // an effect (async via rAF) so the render itself stays pure.
  const [endsAt, setEndsAt] = useState("");
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setEndsAt((v) => v || toLocalInputValue(new Date(Date.now() + 7 * 86_400_000)))
    );
    return () => cancelAnimationFrame(raf);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // datetime-local has no timezone — convert to ISO UTC in the browser,
    // where the user's local timezone is known (§3.8).
    const endsAtLocal = String(fd.get("ends_at") ?? "");
    const endsAtIso = endsAtLocal ? new Date(endsAtLocal).toISOString() : "";
    fd.set("ends_at", endsAtIso);

    const parsed = listingSchema.safeParse({
      title: fd.get("title"),
      description: fd.get("description") ?? "",
      type: fd.get("type"),
      category: fd.get("category") ?? "",
      starting_price: fd.get("starting_price"),
      min_increment: fd.get("min_increment"),
      buy_now_price: fd.get("buy_now_price") ?? "",
      ends_at: endsAtIso,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setPending(true);
    const res = await createListing(fd);
    setPending(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Listing created — it's live!");
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create a listing</CardTitle>
        <CardDescription>
          Auction a product or service. Bidding starts at your starting price.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" maxLength={100} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" rows={4} maxLength={2000} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" className={selectCls} defaultValue="product">
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <select id="category" name="category" className={selectCls} defaultValue="">
                <option value="">None</option>
                {LISTING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="image">Photo (optional, up to 5 MB)</Label>
            <Input id="image" name="image" type="file" accept="image/*" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="starting_price">Starting price ($)</Label>
              <Input
                id="starting_price"
                name="starting_price"
                inputMode="decimal"
                placeholder="25.00"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="min_increment">Min bid increment ($)</Label>
              <Input
                id="min_increment"
                name="min_increment"
                inputMode="decimal"
                defaultValue="1.00"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="buy_now_price">Buy It Now price ($, optional)</Label>
            <Input
              id="buy_now_price"
              name="buy_now_price"
              inputMode="decimal"
              placeholder="leave empty for auction only"
            />
            <p className="text-xs text-muted-foreground">
              Buyers can skip the auction and win instantly at this price. The
              option disappears once bidding reaches it.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ends_at">Auction ends</Label>
            <Input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Between {MIN_LISTING_MINUTES} minutes and {MAX_LISTING_DAYS} days
              from now. Shown in your local time.
            </p>
          </div>

          <p className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            Fees at close: the winner pays your final price plus a 5%
            buyer&apos;s premium. A 5% seller commission — minimum $1 total
            platform fee — is deducted before your payout, which is released
            after the buyer confirms receipt.
          </p>

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create listing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
