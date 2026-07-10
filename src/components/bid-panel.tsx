"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { buyNow } from "@/app/listing/actions";
import { AddPaymentMethodDialog } from "@/components/add-payment-method-dialog";
import { MAX_BID_AMOUNT, REBID_COOLDOWN_MINUTES } from "@/lib/constants";
import {
  addAmounts,
  formatMoney,
  toCents,
  withBuyerPremium,
} from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
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

type Props = {
  listingId: string;
  /** computed server-side at request time (status + deadline) */
  ended: boolean;
  buyNowPrice: string | null;
  startingPrice: string;
  minIncrement: string;
  currentPrice: string;
  hasActiveBids: boolean;
  isOwner: boolean;
  signedIn: boolean;
  hasCard: boolean;
  myBidAmount: string | null;
};

const MONEY_RE = /^\d{1,8}(\.\d{1,2})?$/;

export function BidPanel(props: Props) {
  const router = useRouter();
  const supabase = createClient();

  // order-book rules (mirrors place_bid; the RPC is authoritative): any bid
  // ≥ the starting price is accepted — at or below the leading bid it joins
  // the book; taking the lead requires a full increment step over the top
  const toLead = props.hasActiveBids
    ? addAmounts(props.currentPrice, props.minIncrement)
    : props.startingPrice;

  const [amount, setAmount] = useState(toLead);
  const [pending, setPending] = useState(false);

  // Buy Now is offered until bidding reaches it (mirrors the buy_now RPC guard)
  const buyNowAvailable =
    props.buyNowPrice != null &&
    toCents(props.currentPrice) < toCents(props.buyNowPrice);

  const trimmed = amount.trim();
  const wellFormed = MONEY_RE.test(trimmed);
  // specific, actionable validation states (not just "invalid")
  const tooManyDecimals = /^\d+\.\d{3,}$/.test(trimmed);
  const overMax =
    /^\d{6,}(\.\d+)?$/.test(trimmed) ||
    (wellFormed && toCents(trimmed) > MAX_BID_AMOUNT * 100);
  const validAmount = wellFormed && !overMax;
  const allInTotal = validAmount ? withBuyerPremium(trimmed) : "";
  const cents = validAmount ? toCents(trimmed) : NaN;
  const position = overMax
    ? "cap"
    : !validAmount
      ? null
      : cents < toCents(props.startingPrice)
        ? "floor"
        : !props.hasActiveBids || cents >= toCents(toLead)
          ? "lead"
          : cents > toCents(props.currentPrice)
            ? "deadzone"
            : "book";
  // a bid the RPC would reject shouldn't show a fee preview or submit
  const placeable = position === "lead" || position === "book";

  async function placeBid() {
    const value = amount.trim();
    if (!MONEY_RE.test(value)) {
      toast.error("Enter an amount like 25 or 25.50");
      return;
    }
    if (toCents(value) < toCents(props.startingPrice)) {
      toast.error(`Bids start at ${formatMoney(props.startingPrice)}`);
      return;
    }
    if (toCents(value) > MAX_BID_AMOUNT * 100) {
      toast.error(`Bids max out at ${formatMoney(String(MAX_BID_AMOUNT))}`);
      return;
    }
    if (
      props.hasActiveBids &&
      toCents(value) > toCents(props.currentPrice) &&
      toCents(value) < toCents(toLead)
    ) {
      toast.error(`To take the lead, bid at least ${formatMoney(toLead)}`);
      return;
    }
    setPending(true);
    const { error } = await supabase.rpc("place_bid", {
      p_listing_id: props.listingId,
      p_amount: value,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Bid placed at ${formatMoney(value)}`);
    router.refresh();
  }

  async function purchaseNow() {
    if (!props.hasCard) {
      toast.error("Add a card before buying");
      return;
    }
    setPending(true);
    const res = await buyNow(props.listingId);
    setPending(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Bought! The auction is yours — see it in your purchases.");
    router.refresh();
  }

  async function withdrawBid() {
    setPending(true);
    const { error } = await supabase.rpc("withdraw_bid", {
      p_listing_id: props.listingId,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Bid withdrawn — the price falls to the next-highest bid. You can re-enter this auction in ${REBID_COOLDOWN_MINUTES} minutes.`
    );
    router.refresh();
  }

  if (props.ended) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auction ended</CardTitle>
          <CardDescription>
            Bidding is closed. Final price: {formatMoney(props.currentPrice)}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!props.signedIn) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in to bid</CardTitle>
          <CardDescription>
            Bidding is free — you can withdraw anytime before close.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            nativeButton={false}
            render={<Link href={`/auth?next=/listing/${props.listingId}`} />}
          >
            Sign in / Sign up
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (props.isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your listing</CardTitle>
          <CardDescription>
            You can&apos;t bid on your own listing. Buyers&apos; questions
            arrive via public chat and DMs.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Place a bid</CardTitle>
        <CardDescription>
          {props.hasActiveBids ? (
            <>
              Leading bid{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(props.currentPrice)}
              </span>{" "}
              — take the lead at {formatMoney(toLead)}+, or bid lower to wait
              in the book.
            </>
          ) : (
            <>No bids yet — bidding starts at {formatMoney(props.startingPrice)}.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {buyNowAvailable && props.buyNowPrice && (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">⚡ Buy It Now</span>
              <span className="text-lg font-bold tabular-nums">
                {formatMoney(props.buyNowPrice)}
              </span>
            </div>
            <Button onClick={purchaseNow} disabled={pending} className="w-full">
              {pending
                ? "Working…"
                : `Buy now for ${formatMoney(props.buyNowPrice)}`}
            </Button>
            <p className="text-xs text-muted-foreground">
              Wins instantly and closes the auction. Card charged{" "}
              {formatMoney(withBuyerPremium(String(props.buyNowPrice)))} (incl.
              5% premium).
            </p>
          </div>
        )}

        {props.myBidAmount && (
          <div className="rounded-md border border-sky-400/30 bg-sky-400/10 p-3 text-sm">
            Your active bid:{" "}
            <span className="font-semibold tabular-nums">
              {formatMoney(props.myBidAmount)}
            </span>
            {toCents(props.myBidAmount) >= toCents(props.currentPrice) ? (
              <span className="ml-1 text-emerald-400">— you&apos;re leading</span>
            ) : (
              <span className="ml-1 text-sky-400">
                — in the book (wins if higher bids withdraw)
              </span>
            )}
          </div>
        )}

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            placeBid();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="bid-amount">Your bid ($)</Label>
            <Input
              id="bid-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tabular-nums"
            />
          </div>

          {position && (
            <p className="text-xs font-medium">
              {position === "lead" && (
                <span className="text-emerald-400">
                  This bid takes the lead.
                </span>
              )}
              {position === "book" && (
                <span className="text-sky-400">
                  Below the leading bid — you&apos;re in the book and win if
                  higher bids withdraw.
                </span>
              )}
              {position === "deadzone" && (
                <span className="text-amber-400">
                  To take the lead, bid at least {formatMoney(toLead)}.
                </span>
              )}
              {position === "floor" && (
                <span className="text-red-400">
                  Bids start at {formatMoney(props.startingPrice)}.
                </span>
              )}
              {position === "cap" && (
                <span className="text-red-400">
                  Bids max out at {formatMoney(String(MAX_BID_AMOUNT))}.
                </span>
              )}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            {validAmount && placeable ? (
              <>
                Win at {formatMoney(trimmed)} → your card is charged{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {formatMoney(allInTotal)}
                </span>{" "}
                (incl. 5% buyer&apos;s premium) when the auction closes.
              </>
            ) : tooManyDecimals ? (
              "Use up to 2 decimals — like 25.50."
            ) : position === "floor" || position === "deadzone" || overMax ? (
              "Adjust your bid above to see your all-in total."
            ) : (
              "Enter a valid amount to see your all-in total."
            )}
          </p>

          {props.hasCard ? (
            <Button
              type="submit"
              disabled={pending || !placeable}
              className="w-full"
            >
              {pending
                ? "Working…"
                : props.myBidAmount
                  ? "Update your bid"
                  : "Place bid"}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <AddPaymentMethodDialog triggerLabel="Add a card to bid" />
              <p className="text-xs text-muted-foreground">
                Your card is saved now and only charged if you win.
              </p>
            </div>
          )}
        </form>

        {props.myBidAmount && (
          <Button
            variant="outline"
            onClick={withdrawBid}
            disabled={pending}
            className="w-full"
          >
            Withdraw bid
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
