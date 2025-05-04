import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { Dashboard } from "@/components/dashboard/dashboard";
import { MainLayout } from "@/components/layout/main-layout";

// Opt out of caching for all data requests in this route
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
      <Dashboard userId={session.user.id} />
    </MainLayout>
  );
}
