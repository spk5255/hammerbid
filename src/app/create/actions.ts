"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listingSchema } from "@/lib/validation/listing";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function createListing(
  formData: FormData
): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to create a listing" };

  const parsed = listingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    type: formData.get("type"),
    category: formData.get("category") ?? "",
    starting_price: formData.get("starting_price"),
    min_increment: formData.get("min_increment"),
    buy_now_price: formData.get("buy_now_price") ?? "",
    ends_at: formData.get("ends_at"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Capability check — completed seller onboarding required (§6A).
  // RLS enforces this again at insert; this just gives a clear error.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_seller")
    .eq("id", user.id)
    .single();
  const { data: pay } = await supabase
    .from("payment_profiles")
    .select("payouts_enabled")
    .eq("id", user.id)
    .single();
  if (!profile?.is_seller || !pay?.payouts_enabled) {
    return { error: "Complete seller setup before creating a listing" };
  }

  let image_url: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > MAX_IMAGE_BYTES) return { error: "Image must be under 5 MB" };
    if (!image.type.startsWith("image/")) {
      return { error: "The uploaded file must be an image" };
    }
    const ext =
      (image.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("listing-images")
      .upload(path, image, { contentType: image.type });
    if (uploadError) {
      return { error: "Image upload failed — try again or skip the image" };
    }
    image_url = admin.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
  }

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      type: parsed.data.type,
      category: parsed.data.category || null,
      image_url,
      starting_price: parsed.data.starting_price,
      min_increment: parsed.data.min_increment,
      buy_now_price: parsed.data.buy_now_price || null,
      current_price: parsed.data.starting_price, // DB trigger re-derives this
      ends_at: parsed.data.ends_at.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Your account isn't allowed to create listings yet"
          : "Could not create the listing — please try again",
    };
  }
  return { id: listing.id };
}
