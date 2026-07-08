"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REASONS = ["spam", "harassment", "scam", "offensive", "other"] as const;

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover";

export function MessageReportDialog({
  message,
  onClose,
}: {
  message: { id: string; username: string } | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<(typeof REASONS)[number]>("spam");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!message) return;
    setPending(true);
    const { error } = await createClient().rpc("report_message", {
      p_message_id: message.id,
      p_reason: reason,
      p_note: note.trim() || null,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted — thanks for keeping chat clean.");
    setNote("");
    onClose();
  }

  return (
    <Dialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report @{message?.username}&apos;s message</DialogTitle>
          <DialogDescription>
            Reports are reviewed privately. A message reported by enough
            different people is hidden automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-reason">Reason</Label>
            <select
              id="report-reason"
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
            <Label htmlFor="report-note">Note (optional)</Label>
            <Textarea
              id="report-note"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the reviewers should know"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Reporting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
