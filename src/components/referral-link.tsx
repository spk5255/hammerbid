"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Built client-side from location.origin so the link is right in every
// environment (localhost, preview deploys, production).
export function ReferralLink({ username }: { username: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/auth?ref=${username}`);
    setCanShare(typeof navigator.share === "function");
  }, [username]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied — send it to a friend!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: "Join me on Hammerbid",
        text: "Live auctions where every bid moves the price. Sign up with my link and we both get $5 in bid credit.",
        url,
      });
    } catch {
      // user closed the share sheet — nothing to do
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Your referral link"
        className="h-11 font-mono text-sm"
      />
      <div className="flex gap-2">
        <Button onClick={copy} className="h-11 flex-1 font-semibold sm:flex-none">
          {copied ? (
            <>
              <CheckIcon className="size-4" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon className="size-4" />
              Copy link
            </>
          )}
        </Button>
        {canShare && (
          <Button variant="outline" onClick={share} className="h-11">
            <Share2Icon className="size-4" />
            Share
          </Button>
        )}
      </div>
    </div>
  );
}
