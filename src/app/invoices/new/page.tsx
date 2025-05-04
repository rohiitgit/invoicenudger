import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { MainLayout } from "@/components/layout/main-layout";
import { InvoiceForm } from "@/components/invoices/invoice-form";

// Opt out of caching for all data requests in this route
export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
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

  return (
    <MainLayout userId={session.user.id}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Create New Invoice</h1>

        <InvoiceForm userId={session.user.id} />
      </div>
    </MainLayout>
  );
}
