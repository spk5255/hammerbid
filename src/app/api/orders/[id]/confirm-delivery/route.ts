import { NextResponse } from "next/server";
import { releaseOrder } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Buyer confirms receipt (§6A step 6) → records delivery_confirmed_at and
 * releases the held funds to the seller. Only the order's buyer may call it,
 * and only while the order is paid_held.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,buyer_id,status")
    .eq("id", id)
    .maybeSingle();
  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "paid_held") {
    return NextResponse.json(
      { error: "Only a held order can be confirmed" },
      { status: 400 }
    );
  }

  await admin
    .from("orders")
    .update({ delivery_confirmed_at: new Date().toISOString() })
    .eq("id", id);

  const result = await releaseOrder(id);
  return NextResponse.json(result);
}
