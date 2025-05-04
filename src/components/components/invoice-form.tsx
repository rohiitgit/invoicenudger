import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { supabase } from "@/lib/supabase";
import { Client, Invoice } from "@/types";
import { CalendarIcon } from "lucide-react";

const invoiceSchema = z.object({
  client_id: z.string().min(1, "Please select a client"),
  invoice_number: z.string().min(1, "Invoice number is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  issue_date: z.date(),
  due_date: z.date(),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

type InvoiceFormProps = {
  userId: string;
  invoiceId?: string;
};

export function InvoiceForm({ userId, invoiceId }: InvoiceFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!invoiceId;

  // Fetch clients for dropdown
  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["clients", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", userId)
        .order("name");

      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch invoice data if editing
  const { data: invoice, isLoading: isLoadingInvoice } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      return data as Invoice;
    },
    enabled: isEditing,
  });

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      client_id: "",
      invoice_number: "",
      amount: 0,
      issue_date: new Date(),
      due_date: new Date(),
      currency: "USD",
      notes: "",
    },
  });

  // Populate form with invoice data when editing
  useEffect(() => {
    if (invoice) {
      form.reset({
        client_id: invoice.client_id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        issue_date: new Date(invoice.issue_date),
        due_date: new Date(invoice.due_date),
        currency: invoice.currency,
        notes: invoice.notes || "",
      });
    }
  }, [invoice, form]);

  // Create or update invoice mutation
  const mutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const invoiceData = {
        ...values,
        user_id: userId,
        status: isEditing ? undefined : "draft", // Keep existing status when editing
        issue_date: format(values.issue_date, "yyyy-MM-dd"),
        due_date: format(values.due_date, "yyyy-MM-dd"),
      };

      if (isEditing) {
        const { error } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", invoiceId)
          .eq("user_id", userId);

        if (error) throw error;
        return invoiceId;
      } else {
        const { data, error } = await supabase
          .from("invoices")
          .insert(invoiceData)
          .select("id")
          .single();

        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      router.push(`/invoices/${invoiceId}`);
    },
    onError: (error: any) => {
      setError(error.message || "Failed to save invoice");
    },
  });

  const onSubmit = (values: InvoiceFormValues) => {
    setError(null);
    mutation.mutate(values);
  };

  const isLoading = isLoadingClients || isLoadingInvoice || mutation.isPending;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Invoice" : "Create Invoice"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update the invoice details below"
            : "Fill out the form below to create a new invoice"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <Select
              disabled={isLoading}
              value={form.watch("client_id")}
              onValueChange={(value) => form.setValue("client_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.client_id && (
              <p className="text-sm text-red-500">
                {form.formState.errors.client_id.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                disabled={isLoading}
                {...form.register("invoice_number")}
              />
              {form.formState.errors.invoice_number && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.invoice_number.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-8"
                  disabled={isLoading}
                  {...form.register("amount", { valueAsNumber: true })}
                />
              </div>
              {form.formState.errors.amount && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("issue_date") ? (
                      format(form.watch("issue_date"), "PP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch("issue_date")}
                    onSelect={(date) =>
                      date && form.setValue("issue_date", date)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("due_date") ? (
                      format(form.watch("due_date"), "PP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch("due_date")}
                    onSelect={(date) => date && form.setValue("due_date", date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              disabled={isLoading}
              {...form.register("notes")}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? "Saving..."
              : isEditing
                ? "Update Invoice"
                : "Create Invoice"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
