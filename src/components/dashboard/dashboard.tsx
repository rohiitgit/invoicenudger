"use client";
import { Invoice, InvoiceStatus } from "@/types";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow, isPast, parseISO, format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Users,
} from "lucide-react";

type DashboardProps = {
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
  paid: <CheckCircle2 className="h-4 w-4" />,
  overdue: <AlertCircle className="h-4 w-4" />,
};

export function Dashboard({ userId }: DashboardProps) {
  const [selectedTab, setSelectedTab] = useState<"all" | InvoiceStatus>("all");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
        *,
        client: clients(*)
      `,
        )
        .eq("user_id", userId)
        .order("due_date", { ascending: false });

      if (error) throw error;

      //Update any sent invoices that are now overdue

      const now = new Date();
      const updatedInvoices = (data as Invoice[]).map((invoice) => {
        if (invoice.status === "sent" && isPast(parseISO(invoice.due_date))) {
          return { ...invoice, status: "overdue" };
        }
        return invoice;
      });

      //If any status was changed, update them in database
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
    refetchInterval: 1000 * 60 * 60,
  });

  //Calculate dashboard status
  const dashboardStats = invoices
    ? {
        totalOutstanding: invoices
          .filter((inv) => inv.status !== "paid")
          .reduce((sum, inv) => sum + inv.amount, 0),
        overdueAmount: invoices
          .filter((inv) => inv.status === "overdue")
          .reduce((sum, inv) => sum + inv.amount, 0),
        invoicesByStatus: [
          {
            status: "sent",
            count: invoices.filter((inv) => inv.status === "sent").length,
          },
          {
            status: "overdue",
            count: invoices.filter((inv) => inv.status === "overdue").length,
          },
          {
            status: "paid",
            count: invoices.filter((inv) => inv.status === "paid").length,
          },
        ],
        totalInvoices: invoices.length,
        clientCount: new Set(invoices.map((inv) => inv.client_id)).size,
      }
    : null;

  //Filter invoices based on selected tab
  const filteredInvoices = invoices
    ? selectedTab == "all"
      ? invoices
      : invoices.filter((inv) => inv.status === selectedTab)
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Status Card */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">
              {" "}
              Total Outstanding
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="text-2xl font-bold">
                ${dashboardStats?.totalOutstanding.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overdue Amount
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="text-2xl font-bold text-red-500">
                ${dashboardStats?.overdueAmount.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Invoices
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="text-2xl font-bold ">
                ${dashboardStats?.totalInvoices}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Clients
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="text-2xl font-bold ">
                ${dashboardStats?.clientCount}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invoices</CardTitle>
            <Button size="sm" asChild>
              <a href="/invoices/new">New Invoice</a>
            </Button>
          </div>
          <CardDescription>
            Manage your invoices and payment reminders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedTab}
            onValueChange={(value) =>
              setSelectedTab(value as "all" | InvoiceStatus)
            }
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="space-y-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                  <h3 className="text-lg font-medium">No Invoices Found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTab === "all"
                      ? "Create your first invoice to get started"
                      : `You dont have any ${selectedTab} invoices`}
                  </p>
                  {selectedTab === "all" && (
                    <Button className="mt-4" asChild>
                      <a href="/invoices/new">Create Invoice</a>
                    </Button>
                  )}
                </div>
              ) : (
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
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>{invoice.client?.name}</TableCell>
                        <TableCell>{invoice.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {format(parseISO(invoice.due_date), "MMM DD YYYY")}
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
                                {invoice.status.replace("_", "_")}
                              </span>
                            </span>
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`/invoices/${invoice.id}`}>View</a>
                            </Button>
                            {(invoice.status === "sent" ||
                              invoice.status === "overdue") && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={`/invoices/${invoice.id}/reminders`}>
                                  Remind
                                </a>
                              </Button>
                            )}
                            {invoice.status !== "paid" && (
                              <Button size="sm" variant="default">
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
