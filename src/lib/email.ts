import mail from "@sendgrid/mail";

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  mail.setApiKey(process.env.SENDGRID_API_KEY);
}

type EmailContent = {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
};

export async function sendEmail(
  content: EmailContent,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SendGrid API key is not configured");
    }

    const fromEmail =
      content.fromEmail ||
      process.env.EMAIL_FROM ||
      "noreply@invoicenudger.com";
    const fromName = content.fromName || "Invoice Nudger";
    const replyTo = content.replyTo || fromEmail;

    const msg = {
      to: content.to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: content.subject,
      html: content.body,
      replyTo,
    };

    await mail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Email sending failed:", error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

// For development/MVP, this function will process pending reminders
// In production, this would be called by a cron job or serverless function
export async function processScheduledReminders(supabase: any): Promise<void> {
  try {
    const now = new Date();

    // Get all pending reminders that are due to be sent
    const { data: dueReminders, error } = await supabase
      .from("reminders")
      .select(
        `
        *,
        invoice:invoices(
          *,
          client:clients(*)
        ),
        template:message_templates(*)
      `,
      )
      .eq("status", "pending")
      .lte("scheduled_date", now.toISOString());

    if (error) throw error;

    if (!dueReminders || dueReminders.length === 0) {
      return; // No reminders to process
    }

    for (const reminder of dueReminders) {
      try {
        // Skip if invoice is already paid
        if (reminder.invoice.status === "paid") {
          await supabase
            .from("reminders")
            .update({ status: "cancelled" })
            .eq("id", reminder.id);
          continue;
        }

        // Format template with invoice/client details
        const formattedTemplate = formatEmailTemplate(
          reminder.template,
          reminder.invoice,
        );

        // Get user info for sending from their email
        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("id", reminder.invoice.user_id)
          .single();

        // Send the email
        const emailResult = await sendEmail({
          to: reminder.invoice.client.email,
          subject: formattedTemplate.subject,
          body: formattedTemplate.body,
          fromName: user?.full_name || undefined,
          replyTo: user?.email || undefined,
        });

        if (emailResult.success) {
          // Update reminder status to sent
          await supabase
            .from("reminders")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .eq("id", reminder.id);
        } else {
          console.error(
            `Failed to send reminder ${reminder.id}: ${emailResult.error}`,
          );
        }
      } catch (reminderError) {
        console.error(
          `Error processing reminder ${reminder.id}:`,
          reminderError,
        );
      }
    }
  } catch (error) {
    console.error("Error processing scheduled reminders:", error);
  }
}

function formatEmailTemplate(
  template: any,
  invoice: any,
): { subject: string; body: string } {
  if (!template || !invoice || !invoice.client) {
    throw new Error("Missing required data for email template");
  }

  // Calculate days overdue
  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  const daysOverdue = Math.floor(
    (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  let subject = template.subject;
  let body = template.body;

  // Replace placeholders
  const replacements: Record<string, string> = {
    "{invoice_number}": invoice.invoice_number,
    "{amount}": `${invoice.currency} ${invoice.amount.toFixed(2)}`,
    "{due_date}": dueDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    "{days_overdue}": String(daysOverdue > 0 ? daysOverdue : 0),
    "{client_name}": invoice.client.name,
    "{user_name}": "", // This would be populated with user data
    "{company_name}": "", // This would be populated with user data
  };

  Object.entries(replacements).forEach(([key, value]) => {
    subject = subject.replace(new RegExp(key, "g"), value);
    body = body.replace(new RegExp(key, "g"), value);
  });

  // Convert plain text to HTML with line breaks
  body = body.replace(/\n/g, "<br />");

  return { subject, body };
}
