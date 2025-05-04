import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import { Alert, AlertDescription } from "@/components/ui/alert";

import { supabase } from "@/lib/supabase";
import { Client } from "@/types";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  company_name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

type ClientFormProps = {
  userId: string;
  clientId?: string;
};

export function ClientForm({ userId, clientId }: ClientFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!clientId;

  // Fetch client data if editing
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      return data as Client;
    },
    enabled: isEditing,
  });

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      email: "",
      company_name: "",
      phone: "",
      address: "",
      notes: "",
    },
  });

  // Populate form with client data when editing
  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        email: client.email,
        company_name: client.company_name || "",
        phone: client.phone || "",
        address: client.address || "",
        notes: client.notes || "",
      });
    }
  }, [client, form]);

  // Create or update client mutation
  const mutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const clientData = {
        ...values,
        user_id: userId,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", clientId)
          .eq("user_id", userId);

        if (error) throw error;
        return clientId;
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert(clientData)
          .select("id")
          .single();

        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      router.push("/clients");
    },
    onError: (error: any) => {
      setError(error.message || "Failed to save client");
    },
  });

  const onSubmit = (values: ClientFormValues) => {
    setError(null);
    mutation.mutate(values);
  };

  const isLoading = isLoadingClient || mutation.isPending;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Client" : "Add New Client"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update the client details below"
            : "Fill out the form below to add a new client"}
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
            <Label htmlFor="name">Name</Label>
            <Input id="name" disabled={isLoading} {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              disabled={isLoading}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-500">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name (Optional)</Label>
            <Input
              id="company_name"
              disabled={isLoading}
              {...form.register("company_name")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                disabled={isLoading}
                {...form.register("phone")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                disabled={isLoading}
                {...form.register("address")}
              />
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
                ? "Update Client"
                : "Add Client"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
