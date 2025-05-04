import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { AuthForm } from "@/components/auth/auth-form";

export default async function HomePage() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  // Check if user is already logged in
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If logged in, redirect to dashboard
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Invoice Nudger</h1>
            <p className="mt-2 text-gray-600">
              Automatically follow up on unpaid invoices with increasingly
              assertive messages
            </p>
          </div>

          <AuthForm />
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-gray-500">
        <p>
          © {new Date().getFullYear()} Invoice Nudger - A better way to get
          paid on time
        </p>
      </footer>
    </div>
  );
}
