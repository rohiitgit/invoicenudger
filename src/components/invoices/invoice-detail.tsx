"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, formatDistanceToNow, isPast } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  Send,
  Edit,
  Trash2,
  ArrowLeft,
  Mail,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { Invoice, InvoiceStatus, Reminder } from "@/types";
import { supabase } from "@/lib/supabase";

type InvoiceDetailProps = {
  userId: string;
  invoiceId: string;
};

const statusColors: Record<InvoiceStatus, string> = {
  draft: "bg-gray-200 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
};

const statusIcons: Record<InvoiceStatus, React.ReactNode> = {
  draft: <Clock className="h-5 w-5" />,
  sent: <FileText className="h-5 w-5" />,
  partially_paid: <AlertCircle className="h-5 w-5" />,
  paid: <CheckCircle2 className="h-5 w-5" />,
  overdue: <AlertCircle className="h-5 w-5" />,
};

export function InvoiceDetail({ userId, invoiceId }: InvoiceDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch invoice data
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          *,
          client:clients(*)
        `,
        )
        .eq("id", invoiceId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      // Update status if it's overdue
      if (data.status === "sent" && isPast(parseISO(data.due_date))) {
        const { error: updateError } = await supabase
          .from("invoices")
          .update({ status: "overdue" })
          .eq("id", invoiceId);

        if (!updateError) {
          data.status = "overdue";
        }
      }

      return data as Invoice & { client: any };
    },
  });

  // Fetch reminders for this invoice
  const { data: reminders } = useQuery({
    queryKey: ["reminders", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select(
          `
          *,
          template:message_templates(*)
        `,
        )
        .eq("invoice_id", invoiceId)
        .order("scheduled_date", { ascending: false });

      if (error) throw error;
      return data as (Reminder & { template: any })[];
    },
    enabled: !!invoice,
  });

  // Mark invoice as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoiceId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Invoice marked as paid",
        description: "The invoice has been successfully marked as paid.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark invoice as paid. Please try again.",
        variant: "destructive",
      });
      console.error("Error marking invoice as paid:", error);
    },
  });

  // Send invoice to client mutation (for demo purposes)
  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      // In a real app, this would send an email with the invoice
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", invoiceId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Invoice sent",
        description: "The invoice has been successfully sent to the client.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send invoice. Please try again.",
        variant: "destructive",
      });
      console.error("Error sending invoice:", error);
    },
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      // First delete all reminders for this invoice
      const { error: reminderError } = await supabase
        .from("reminders")
        .delete()
        .eq("invoice_id", invoiceId);

      if (reminderError) throw reminderError;

      // Then delete the invoice
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push("/invoices");
      toast({
        title: "Invoice deleted",
        description: "The invoice has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting invoice:", error);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-8 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Invoice Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              The requested invoice could not be found or you don't have access
              to it.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/invoices">Back to Invoices</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Link>
          </Button>

          <Badge className={statusColors[invoice.status]}>
            <span className="flex items-center gap-1">
              {statusIcons[invoice.status]}
              <span className="capitalize">
                {invoice.status.replace("_", " ")}
              </span>
            </span>
          </Badge>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>

          {invoice.status === "draft" && (
            <Button
              size="sm"
              onClick={() => sendInvoiceMutation.mutate()}
              disabled={sendInvoiceMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendInvoiceMutation.isPending ? "Sending..." : "Send to Client"}
            </Button>
          )}

          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button
              size="sm"
              onClick={() => markAsPaidMutation.mutate()}
              disabled={markAsPaidMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {markAsPaidMutation.isPending ? "Updating..." : "Mark as Paid"}
            </Button>
          )}

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">
            Invoice #{invoice.invoice_number}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Client
              </h3>
              <p className="text-lg font-medium">{invoice.client?.name}</p>
              <p className="text-sm">{invoice.client?.email}</p>
              {invoice.client?.company_name && (
                <p className="text-sm">{invoice.client?.company_name}</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Amount
              </h3>
              <p className="text-2xl font-bold">${invoice.amount.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Issue Date
              </h3>
              <p className="text-lg font-medium">
                {format(parseISO(invoice.issue_date), "MMMM d, yyyy")}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Due Date
              </h3>
              <p className="text-lg font-medium">
                {format(parseISO(invoice.due_date), "MMMM d, yyyy")}
              </p>
              {invoice.status !== "paid" && (
                <p className="text-sm text-muted-foreground">
                  {isPast(parseISO(invoice.due_date))
                    ? `${formatDistanceToNow(parseISO(invoice.due_date))} overdue`
                    : `Due in ${formatDistanceToNow(parseISO(invoice.due_date))}`}
                </p>
              )}
            </div>

            {invoice.notes && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Notes
                </h3>
                <p className="text-sm whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Reminders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payment Reminders</h2>

          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button asChild>
              <Link href={`/invoices/${invoice.id}/reminders`}>
                <Mail className="h-4 w-4 mr-2" />
                Schedule Reminder
              </Link>
            </Button>
          )}
        </div>

        {!reminders || reminders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-6 text-center">
              <Mail className="h-8 w-8 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No reminders scheduled</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Schedule a reminder to follow up on this invoice
              </p>

              {(invoice.status === "sent" || invoice.status === "overdue") && (
                <Button className="mt-4" asChild>
                  <Link href={`/invoices/${invoice.id}/reminders`}>
                    Schedule Reminder
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-4 border rounded-md"
                  >
                    <div className="flex flex-col">
                      <p className="font-medium">
                        {reminder.template.template_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(
                          parseISO(reminder.scheduled_date),
                          "MMMM d, yyyy",
                        )}
                      </p>
                    </div>
                    <Badge
                      variant={
                        reminder.status === "sent"
                          ? "default"
                          : reminder.status === "pending"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {reminder.status === "sent"
                        ? `Sent ${
                            reminder.sent_at
                              ? format(parseISO(reminder.sent_at), "MMM d")
                              : ""
                          }`
                        : reminder.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete invoice #{invoice.invoice_number}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => deleteInvoiceMutation.mutate()}
              disabled={deleteInvoiceMutation.isPending}
            >
              {deleteInvoiceMutation.isPending
                ? "Deleting..."
                : "Delete Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
