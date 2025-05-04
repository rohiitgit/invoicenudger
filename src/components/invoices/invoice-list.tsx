"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast, parseISO, formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  Check,
  AlertCircle,
  Clock,
  Search,
  MoreVertical,
  Copy,
  Edit,
  Trash2,
  Printer,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { Invoice, InvoiceStatus } from "@/types";
import { supabase } from "@/lib/supabase";

type InvoiceListProps = {
  userId: string;
};

const statusColors: Record<InvoiceStatus, string> = {
  draft: "bg-gray-200 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
};

const statusIcons: Record<InvoiceStatus, React.ReactNode> = {
  draft: <Clock className="h-4 w-4" />,
  sent: <FileText className="h-4 w-4" />,
  partially_paid: <AlertCircle className="h-4 w-4" />,
  paid: <Check className="h-4 w-4" />,
  overdue: <AlertCircle className="h-4 w-4" />,
};

export function InvoiceList({ userId }: InvoiceListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Fetch invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          *,
          client:clients(*)
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Update any sent invoices that are now overdue
      const now = new Date();
      const updatedInvoices = (data as Invoice[]).map((invoice) => {
        if (invoice.status === "sent" && isPast(parseISO(invoice.due_date))) {
          return { ...invoice, status: "overdue" };
        }
        return invoice;
      });

      // If any statuses were changed, update them in the database
      const overdueInvoices = updatedInvoices.filter(
        (invoice, index) => invoice.status !== data[index].status,
      );

      if (overdueInvoices.length > 0) {
        await Promise.all(
          overdueInvoices.map((invoice) =>
            supabase
              .from("invoices")
              .update({ status: "overdue" })
              .eq("id", invoice.id),
          ),
        );
      }

      return updatedInvoices as Invoice[];
    },
  });

  // Mark invoice as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoiceId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
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

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
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
      setSelectedInvoice(null);
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

  // Filter invoices based on search term
  const filteredInvoices = invoices?.filter((invoice) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(searchLower) ||
      invoice.client?.name.toLowerCase().includes(searchLower) ||
      invoice.client?.company_name?.toLowerCase().includes(searchLower) ||
      invoice.amount.toString().includes(searchLower)
    );
  });

  const handleMarkAsPaid = (invoiceId: string) => {
    markAsPaidMutation.mutate(invoiceId);
  };

  const handleDeleteInvoice = () => {
    if (selectedInvoice) {
      deleteInvoiceMutation.mutate(selectedInvoice.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Button asChild>
          <Link href="/invoices/new">New Invoice</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            Manage your invoices and payment statuses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !filteredInvoices || filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No invoices found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Create your first invoice to get started"}
              </p>
              {!searchTerm && (
                <Button className="mt-4" asChild>
                  <Link href="/invoices/new">Create Invoice</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.client?.name}</TableCell>
                      <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {format(parseISO(invoice.due_date), "MMM d, yyyy")}
                        {invoice.status !== "paid" && (
                          <div className="text-xs text-muted-foreground">
                            {isPast(parseISO(invoice.due_date))
                              ? `${formatDistanceToNow(parseISO(invoice.due_date))} overdue`
                              : `Due in ${formatDistanceToNow(parseISO(invoice.due_date))}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[invoice.status]}>
                          <span className="flex items-center gap-1">
                            {statusIcons[invoice.status]}
                            <span className="capitalize">
                              {invoice.status.replace("_", " ")}
                            </span>
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          {/* Quick Actions */}
                          {invoice.status !== "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(invoice.id)}
                              disabled={markAsPaidMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              <span>Mark Paid</span>
                            </Button>
                          )}

                          {(invoice.status === "sent" ||
                            invoice.status === "overdue") && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/invoices/${invoice.id}/reminders`}>
                                <Send className="h-4 w-4 mr-1" />
                                <span>Remind</span>
                              </Link>
                            </Button>
                          )}

                          {/* More Options */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Options</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/invoices/${invoice.id}`}
                                  className="cursor-pointer"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/invoices/${invoice.id}/edit`}
                                  className="cursor-pointer"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Invoice
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSelectedInvoice(invoice)}
                              >
                                <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                                <span className="text-red-500">Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete invoice{" "}
              {selectedInvoice?.invoice_number}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteInvoice}
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
