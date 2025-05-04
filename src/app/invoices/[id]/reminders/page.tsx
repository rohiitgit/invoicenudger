import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { MainLayout } from "@/components/layout/main-layout";
import { ReminderScheduler } from "@/components/reminders/reminder-scheduler";

// Opt out of caching for all data requests in this route
export const dynamic = "force-dynamic";

export default async function InvoiceReminderPage({
  params,
}: {
  params: { id: string };
}) {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  // Check if user is logged in
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If not logged in, redirect to login page
  if (!session) {
    redirect("/");
  }

  // Check if invoice exists and belongs to user
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .single();

  // If invoice not found or doesn't belong to user, redirect to invoices page
  if (error || !invoice) {
    redirect("/invoices");
  }

  return (
    <MainLayout userId={session.user.id}>
      <ReminderScheduler userId={session.user.id} invoiceId={params.id} />
    </MainLayout>
  );
}
