import { redirect } from "next/navigation";
import { CreateListingForm } from "@/components/create-listing-form";
import { EnableSellingCard } from "@/components/enable-selling-card";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CreatePage() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !profile) redirect("/auth?next=/create");

  const supabase = await createClient();
  const { data: pay } = await supabase
    .from("payment_profiles")
    .select("payouts_enabled")
    .eq("id", user.id)
    .single();
  const payoutsEnabled = pay?.payouts_enabled ?? false;
  const canList = profile.is_seller && payoutsEnabled;

  return (
    <main className="flex flex-1 items-start justify-center p-8">
      {canList ? (
        <CreateListingForm />
      ) : (
        <EnableSellingCard
          isSeller={profile.is_seller}
          payoutsEnabled={payoutsEnabled}
        />
      )}
    </main>
  );
}
