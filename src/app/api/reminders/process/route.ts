import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { processScheduledReminders } from "@/lib/email";

// This API route can be triggered manually or by a cron job
export async function POST(request: NextRequest) {
  try {
    // Check for API key in headers for additional security
    const apiKey = request.headers.get("x-api-key");
    const secretKey = process.env.API_SECRET_KEY;

    // In production, you'd want to enforce API key validation
    // For the MVP, we'll make this check optional
    if (secretKey && apiKey !== secretKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Process all scheduled reminders that are due
    await processScheduledReminders(supabase);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing reminders:", error);
    return NextResponse.json(
      { error: "Failed to process reminders" },
      { status: 500 },
    );
  }
}

// Optional: Allow GET requests for easier testing during development
export async function GET() {
  // Only allow this in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    await processScheduledReminders(supabase);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing reminders:", error);
    return NextResponse.json(
      { error: "Failed to process reminders" },
      { status: 500 },
    );
  }
}
