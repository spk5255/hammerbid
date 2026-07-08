"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type DM = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const REASONS = ["spam", "harassment", "scam", "offensive", "other"] as const;
const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover";

export function DMThread({
  conversationId,
  viewerId,
  otherId,
  otherUsername,
  initialMessages,
  initiallyBlocked,
}: {
  conversationId: string;
  viewerId: string;
  otherId: string;
  otherUsername: string;
  initialMessages: DM[];
  initiallyBlocked: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<DM[]>(initialMessages);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("spam");
  const [note, setNote] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // mark received messages read (recipients may only touch read_at — §7)
  async function markRead() {
    await createClient()
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", viewerId)
      .is("read_at", null);
    router.refresh(); // clears the navbar unread badge
  }

  useEffect(() => {
    markRead();
    const supabase = createClient();
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as DM;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row]
          );
          if (row.sender_id !== viewerId) markRead();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewerId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (text.length > 2000) {
      toast.error("Messages are limited to 2000 characters");
      return;
    }
    setPending(true);
    const { data, error } = await createClient()
      .from("direct_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: viewerId,
        body: text,
      })
      .select("id,sender_id,body,created_at,read_at")
      .single();
    setPending(false);
    if (error) {
      if (error.code === "42501") {
        setBlocked(true);
        toast.error("Messaging is unavailable between you two.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    setBody("");
    setMessages((prev) =>
      prev.some((m) => m.id === data.id) ? prev : [...prev, data as DM]
    );
  }

  async function block() {
    const { error } = await createClient()
      .from("blocks")
      .insert({ blocker_id: viewerId, blocked_id: otherId });
    if (error && error.code !== "23505") {
      toast.error(error.message);
      return;
    }
    setBlocked(true);
    toast.success(`@${otherUsername} blocked — you can unblock in Settings.`);
  }

  async function submitReport() {
    setPending(true);
    const { error } = await createClient().from("dm_reports").insert({
      conversation_id: conversationId,
      reporter_id: viewerId,
      reason,
      note: note.trim() || null,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted for review.");
    setNote("");
    setReportOpen(false);
  }

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <p className="text-sm font-medium">
          Conversation with{" "}
          <span className="text-sky-400">@{otherUsername}</span>
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
            Report
          </Button>
          {!blocked && (
            <Button variant="ghost" size="sm" onClick={block}>
              Block
            </Button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="flex max-h-[28rem] min-h-60 flex-col gap-2 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <p className="m-auto py-10 text-sm text-muted-foreground">
            No messages yet — ask about shipping, condition, anything.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === viewerId;
            return (
              <div
                key={m.id}
                className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                  mine
                    ? "self-end bg-sky-500/15 text-foreground"
                    : "self-start bg-muted"
                )}
              >
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p
                  className="mt-1 text-right text-[10px] text-muted-foreground"
                  suppressHydrationWarning
                >
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border/60 p-3">
        {blocked ? (
          <p className="text-sm text-muted-foreground">
            Messaging unavailable — one of you has blocked the other.
          </p>
        ) : (
          <form onSubmit={send} className="flex gap-2">
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder={`Message @${otherUsername}…`}
              className="flex-1"
            />
            <Button type="submit" disabled={pending}>
              Send
            </Button>
          </form>
        )}
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this conversation</DialogTitle>
            <DialogDescription>
              Reports on private threads go to the review team. DM history is
              retained for dispute review.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dm-report-reason">Reason</Label>
              <select
                id="dm-report-reason"
                className={selectCls}
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as (typeof REASONS)[number])
                }
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dm-report-note">Note (optional)</Label>
              <Textarea
                id="dm-report-note"
                rows={3}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReportOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submitReport} disabled={pending}>
              {pending ? "Reporting…" : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
