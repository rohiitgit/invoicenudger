"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import {
  Users,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { Client } from "@/types";
import { supabase } from "@/lib/supabase";

type ClientListProps = {
  userId: string;
};

export function ClientList({ userId }: ClientListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Fetch clients
  const { data: clients, isLoading } = useQuery({
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

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      // First check if there are any invoices for this client
      const { count, error: countError } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId);

      if (countError) throw countError;

      // If there are invoices, don't allow deletion
      if (count && count > 0) {
        throw new Error("Cannot delete client with existing invoices");
      }

      // Delete the client
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setSelectedClient(null);
      toast({
        title: "Client deleted",
        description: "The client has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to delete client. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting client:", error);
    },
  });

  // Filter clients based on search term
  const filteredClients = clients?.filter((client) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower) ||
      (client.company_name &&
        client.company_name.toLowerCase().includes(searchLower)) ||
      (client.phone && client.phone.toLowerCase().includes(searchLower))
    );
  });

  const handleDeleteClient = () => {
    if (selectedClient) {
      deleteClientMutation.mutate(selectedClient.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Button asChild>
          <Link href="/clients/new">
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Clients</CardTitle>
          <CardDescription>Manage your client information</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !filteredClients || filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No clients found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first client to get started"}
              </p>
              {!searchTerm && (
                <Button className="mt-4" asChild>
                  <Link href="/clients/new">Add Client</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.company_name || "-"}</TableCell>
                      <TableCell>{client.phone || "-"}</TableCell>
                      <TableCell className="text-right">
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
                                href={`/clients/${client.id}`}
                                className="cursor-pointer"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/clients/${client.id}/edit`}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Client
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setSelectedClient(client)}
                              className="text-red-500 focus:text-red-500"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedClient?.name}? This
              action cannot be undone.
              <p className="mt-2 text-sm font-medium">
                Note: You cannot delete clients who have associated invoices.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteClient}
              disabled={deleteClientMutation.isPending}
            >
              {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
