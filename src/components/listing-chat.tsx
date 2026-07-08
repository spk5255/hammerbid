"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageReportDialog } from "@/components/message-report-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  username: string;
};

type MessageRow = {
  id: string;
  listing_id: string;
  user_id: string;
  body: string;
  hidden: boolean;
  created_at: string;
};

export function ListingChat({
  listingId,
  viewerId,
  viewerUsername,
  isOwner,
  initialMessages,
}: {
  listingId: string;
  viewerId: string | null;
  viewerUsername: string | null;
  isOwner: boolean;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    username: string;
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const lastSentAt = useRef(0);
  // username lookup cache for realtime inserts from users we haven't seen
  const namesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const m of initialMessages) namesRef.current.set(m.user_id, m.username);
    if (viewerId && viewerUsername) namesRef.current.set(viewerId, viewerUsername);
  }, [initialMessages, viewerId, viewerUsername]);

  useEffect(() => {
    const supabase = createClient();

    async function usernameFor(userId: string): Promise<string> {
      const cached = namesRef.current.get(userId);
      if (cached) return cached;
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      const name = data?.username ?? "unknown";
      namesRef.current.set(userId, name);
      return name;
    }

    const channel = supabase
      .channel(`listing-chat-${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `listing_id=eq.${listingId}`,
        },
        async (payload) => {
          const row = payload.new as MessageRow;
          if (row.hidden) return;
          const username = await usernameFor(row.user_id);
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    user_id: row.user_id,
                    body: row.body,
                    created_at: row.created_at,
                    username,
                  },
                ]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          // auto-moderation: hidden flips true → remove for everyone, live
          if (row.hidden) {
            setMessages((prev) => prev.filter((m) => m.id !== row.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (oldRow?.id) {
            setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listingId]);

  // keep the newest message in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      toast.error("Write something first");
      return;
    }
    if (text.length > 500) {
      toast.error("Messages are limited to 500 characters");
      return;
    }
    // basic client-side rate limit (~1 message/second, §12.13)
    if (Date.now() - lastSentAt.current < 1000) {
      toast.error("Slow down — one message per second");
      return;
    }
    if (!viewerId) return;

    setPending(true);
    const { data, error } = await createClient()
      .from("messages")
      .insert({ listing_id: listingId, user_id: viewerId, body: text })
      .select("id,user_id,body,created_at")
      .single();
    setPending(false);
    if (error) {
      toast.error(
        error.code === "42501"
          ? "You can't post in this chat"
          : error.message
      );
      return;
    }
    lastSentAt.current = Date.now();
    setBody("");
    setMessages((prev) =>
      prev.some((m) => m.id === data.id)
        ? prev
        : [
            ...prev,
            {
              id: data.id,
              user_id: data.user_id,
              body: data.body,
              created_at: data.created_at,
              username: viewerUsername ?? "me",
            },
          ]
    );
  }

  async function remove(id: string) {
    const { error } = await createClient()
      .from("messages")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success("Message deleted");
  }

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card">
      <div
        ref={listRef}
        className="flex max-h-96 min-h-40 flex-col gap-1 overflow-y-auto p-3"
      >
        {messages.length === 0 ? (
          <p className="m-auto py-8 text-sm text-muted-foreground">
            No messages yet — say something about this listing.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="group flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
            >
              <span className="shrink-0 font-medium text-sky-400">
                @{m.username}
              </span>
              <span className="min-w-0 break-words">{m.body}</span>
              <span
                className="ml-auto shrink-0 text-[10px] text-muted-foreground"
                suppressHydrationWarning
              >
                {new Date(m.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {viewerId && (
                <span className="hidden shrink-0 gap-1 group-hover:inline-flex">
                  {m.user_id === viewerId ? (
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setReportTarget({ id: m.id, username: m.username })
                      }
                      className="text-[10px] text-muted-foreground hover:underline"
                    >
                      Report
                    </button>
                  )}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border/60 p-3">
        {!viewerId ? (
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/auth?next=/listing/${listingId}`}
              className="text-sky-400 hover:underline"
            >
              Sign in
            </Link>{" "}
            to join the chat.
          </p>
        ) : isOwner ? (
          <p className="text-sm text-muted-foreground">
            You can&apos;t post on your own listing — the public chat belongs
            to your bidders.
          </p>
        ) : (
          <form onSubmit={send} className="flex gap-2">
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={500}
              placeholder="Message the room…"
              className={cn("flex-1", pending && "opacity-70")}
            />
            <Button type="submit" disabled={pending}>
              Send
            </Button>
          </form>
        )}
      </div>

      <MessageReportDialog
        message={reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </div>
  );
}
