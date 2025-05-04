import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, parseISO } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/lib/supabase";
import { Invoice, MessageTemplate, Reminder } from "@/types";
import { CalendarIcon, Clock, Send } from "lucide-react";

const reminderSchema = z.object({
  template_id: z.string().min(1, "Please select a template"),
  scheduled_date: z.date(),
  customSubject: z.string().optional(),
  customBody: z.string().optional(),
});

type ReminderFormValues = z.infer<typeof reminderSchema>;

type ReminderSchedulerProps = {
  userId: string;
  invoiceId: string;
};

export function ReminderScheduler({
  userId,
  invoiceId,
}: ReminderSchedulerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"templates" | "preview">(
    "templates",
  );
  const [error, setError] = useState<string | null>(null);
  const [templateMode, setTemplateMode] = useState<"system" | "custom">(
    "system",
  );
  const [previewTemplate, setPreviewTemplate] =
    useState<MessageTemplate | null>(null);

  // Fetch invoice data
  const { data: invoice, isLoading: isLoadingInvoice } = useQuery({
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
      return data as Invoice & { client: any };
    },
  });

  // Fetch message templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .order("severity_level", { ascending: true });

      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  // Fetch existing reminders for this invoice
  const { data: existingReminders, isLoading: isLoadingReminders } = useQuery({
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
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      return data as (Reminder & { template: MessageTemplate })[];
    },
  });

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      template_id: "",
      scheduled_date: addDays(new Date(), 3),
      customSubject: "",
      customBody: "",
    },
  });

  // Create reminder mutation
  const mutation = useMutation({
    mutationFn: async (values: ReminderFormValues) => {
      let finalTemplateId = values.template_id;

      // If using custom template, create a new template first
      if (templateMode === "custom") {
        const { data: newTemplate, error: templateError } = await supabase
          .from("message_templates")
          .insert({
            user_id: userId,
            template_name: `Custom template for invoice ${invoice?.invoice_number}`,
            subject: values.customSubject || "Invoice Reminder",
            body: values.customBody || "",
            severity_level: 1,
          })
          .select("id")
          .single();

        if (templateError) throw templateError;
        finalTemplateId = newTemplate.id;
      }

      // Create the reminder
      const { error } = await supabase.from("reminders").insert({
        invoice_id: invoiceId,
        template_id: finalTemplateId,
        scheduled_date: format(values.scheduled_date, "yyyy-MM-dd'T'HH:mm:ss"),
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders", invoiceId] });
      router.push(`/invoices/${invoiceId}`);
    },
    onError: (error: any) => {
      setError(error.message || "Failed to schedule reminder");
    },
  });

  // Update preview when template changes
  const selectedTemplateId = form.watch("template_id");

  // Update preview template when selection changes
  useState(() => {
    if (selectedTemplateId && templates) {
      const selected = templates.find((t) => t.id === selectedTemplateId);
      if (selected) {
        setPreviewTemplate(selected);
      }
    }
  });

  const handleSelectTemplate = (templateId: string) => {
    form.setValue("template_id", templateId);
    if (templates) {
      const selected = templates.find((t) => t.id === templateId);
      if (selected) {
        setPreviewTemplate(selected);
      }
    }
  };

  const onSubmit = (values: ReminderFormValues) => {
    setError(null);
    mutation.mutate(values);
  };

  const getFormattedPreview = (template: MessageTemplate) => {
    if (!invoice || !invoice.client) return template;

    // Calculate days overdue
    const dueDate = parseISO(invoice.due_date);
    const today = new Date();
    const daysOverdue = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let subject = template.subject;
    let body = template.body;

    // Replace placeholders
    const replacements = {
      "{invoice_number}": invoice.invoice_number,
      "{amount}": `${invoice.currency} ${invoice.amount.toFixed(2)}`,
      "{due_date}": format(dueDate, "MMMM d, yyyy"),
      "{days_overdue}": String(daysOverdue > 0 ? daysOverdue : 0),
      "{client_name}": invoice.client.name,
      "{user_name}": "", // This would come from the user profile
      "{company_name}": "", // This would come from the user profile
    };

    Object.entries(replacements).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key, "g"), value);
      body = body.replace(new RegExp(key, "g"), value);
    });

    return { ...template, subject, body };
  };

  const isLoading =
    isLoadingInvoice ||
    isLoadingTemplates ||
    isLoadingReminders ||
    mutation.isPending;

  // Get formatted preview if template is selected
  const formattedPreview = previewTemplate
    ? getFormattedPreview(previewTemplate)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Schedule Payment Reminder</h1>

      {invoice && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Invoice
                </h3>
                <p className="text-lg font-medium">{invoice.invoice_number}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Client
                </h3>
                <p className="text-lg font-medium">{invoice.client?.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Amount
                </h3>
                <p className="text-lg font-medium">
                  ${invoice.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Due Date
                </h3>
                <p className="text-lg font-medium">
                  {format(parseISO(invoice.due_date), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {existingReminders && existingReminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Reminders</CardTitle>
            <CardDescription>
              These reminders have already been scheduled for this invoice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {existingReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-4 border rounded-md"
                >
                  <div className="flex items-center space-x-4">
                    {reminder.status === "sent" ? (
                      <Send className="h-5 w-5 text-green-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {reminder.template.template_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(
                          parseISO(reminder.scheduled_date),
                          "MMM d, yyyy",
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={reminder.status === "sent" ? "default" : "outline"}
                  >
                    {reminder.status === "sent" ? "Sent" : "Scheduled"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New Payment Reminder</CardTitle>
          <CardDescription>
            Schedule an automated reminder to be sent to your client
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "templates" | "preview")
            }
          >
            <CardContent>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="templates">Select Template</TabsTrigger>
                <TabsTrigger
                  value="preview"
                  disabled={!selectedTemplateId && templateMode !== "custom"}
                >
                  Preview
                </TabsTrigger>
              </TabsList>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="templates" className="space-y-6">
                <div className="space-y-4">
                  <RadioGroup
                    value={templateMode}
                    onValueChange={(value) =>
                      setTemplateMode(value as "system" | "custom")
                    }
                    className="grid grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="system-templates"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                    >
                      <RadioGroupItem
                        value="system"
                        id="system-templates"
                        className="sr-only"
                      />
                      <span className="text-center">Use Template Library</span>
                    </Label>
                    <Label
                      htmlFor="custom-template"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                    >
                      <RadioGroupItem
                        value="custom"
                        id="custom-template"
                        className="sr-only"
                      />
                      <span className="text-center">Create Custom Message</span>
                    </Label>
                  </RadioGroup>
                </div>

                {templateMode === "system" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {templates?.map((template) => (
                        <div
                          key={template.id}
                          className={`p-4 border rounded-md cursor-pointer ${
                            selectedTemplateId === template.id
                              ? "border-primary bg-primary/5"
                              : ""
                          }`}
                          onClick={() => handleSelectTemplate(template.id)}
                        >
                          <h3 className="font-medium mb-1">
                            {template.template_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {template.subject}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customSubject">Email Subject</Label>
                      <Input
                        id="customSubject"
                        placeholder="e.g., Reminder: Invoice #123 is due soon"
                        {...form.register("customSubject")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customBody">Email Message</Label>
                      <Textarea
                        id="customBody"
                        rows={10}
                        placeholder="Write your custom email message here..."
                        {...form.register("customBody")}
                      />
                      <p className="text-sm text-muted-foreground">
                        You can use placeholders like {"{client_name}"},{" "}
                        {"{invoice_number}"}, {"{amount}"}, and {"{due_date}"}.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Schedule Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch("scheduled_date") ? (
                          format(form.watch("scheduled_date"), "PP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.watch("scheduled_date")}
                        onSelect={(date) =>
                          date && form.setValue("scheduled_date", date)
                        }
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </TabsContent>

              <TabsContent value="preview">
                {formattedPreview ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Subject</Label>
                      <div className="p-4 border rounded-md bg-muted/50">
                        {formattedPreview.subject}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Message</Label>
                      <div className="p-4 border rounded-md bg-muted/50 whitespace-pre-line">
                        {formattedPreview.body}
                      </div>
                    </div>
                  </div>
                ) : templateMode === "custom" ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Subject</Label>
                      <div className="p-4 border rounded-md bg-muted/50">
                        {form.watch("customSubject") || "No subject provided"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Message</Label>
                      <div className="p-4 border rounded-md bg-muted/50 whitespace-pre-line">
                        {form.watch("customBody") || "No message provided"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p>Please select a template to see preview</p>
                  </div>
                )}
              </TabsContent>
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
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  (templateMode === "system" && !selectedTemplateId)
                }
              >
                {isLoading ? "Scheduling..." : "Schedule Reminder"}
              </Button>
            </CardFooter>
          </Tabs>
        </form>
      </Card>
    </div>
  );
}
