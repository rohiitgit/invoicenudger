import { createClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          company_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string | null;
          company_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id: string;
          email: string;
          full_name: string | null;
          company_name: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          company_name: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_at: null;
          updated_at: null;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          company_name: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_at: null;
          updated_at: null;
        };
        Update: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          company_name: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_at: null;
          updated_at: null;
        };
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          invoice_number: string;
          issue_date: string;
          due_date: string;
          amount: number;
          status: string;
          notes: string | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          invoice_number: string;
          issue_date: string;
          due_date: string;
          amount: number;
          status: string;
          notes?: string | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          invoice_number?: string;
          issue_date?: string;
          due_date?: string;
          amount?: number;
          status?: string;
          notes?: string | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      message_templates: {
        Row: {
          id: string;
          user_id: string | null;
          template_name: string;
          subject: string;
          body: string;
          severity_level: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          template_name: string;
          subject: string;
          body: string;
          severity_level: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          template_name?: string;
          subject?: string;
          body?: string;
          severity_level?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      reminders: {
        Row: {
          id: string;
          invoice_id: string;
          template_id: string;
          scheduled_date: string;
          status: string;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          template_id: string;
          scheduled_date: string;
          status: string;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          template_id?: string;
          scheduled_date?: string;
          status?: string;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const createServerSupabaseClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      auth: {
        persistSession: false,
      },
    },
  );
