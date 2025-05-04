export type User = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue";

export type Invoice = {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: InvoiceStatus;
  notes: string | null;
  currency: string;
  created_at: string;
  updated_at: string;

  // may be included thru joins

  client?: Client;
  reminders?: Reminder[];
};

export type MessageTemplate = {
  id: string;
  user_id: string;
  template_name: string;
  subject: string;
  body: string;
  severity_level: number;
  created_at: string;
  updated_at: string;
};

export type ReminderStatus = "pending" | "approved" | "sent" | "cancelled";

export type Reminder = {
  id: string;
  invoice_id: string;
  template_id: string;
  scheduled_date: string;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;

  // may included thru joins
  invoice?: Invoice;
  template?: MessageTemplate;
};

export type DashboardStatus = {
  totalOutstanding: number;
  overdueAmount: number;
  paidLastMonth: number;
  averageDaysToPayment: number;
  invoicesByStaus: {
    status: InvoiceStatus;
    count: number;
  }[];
};
