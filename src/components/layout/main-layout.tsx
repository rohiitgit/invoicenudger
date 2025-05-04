"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  FileText,
  Users,
  Settings,
  LogOut,
  Mail,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { supabase } from "@/lib/supabase";
import { User } from "@/types";

type MainLayoutProps = {
  children: ReactNode;
  userId: string;
};

type NavigationItem = {
  name: string;
  href: string;
  icon: ReactNode;
  alert?: boolean;
};

export function MainLayout({ children, userId }: MainLayoutProps) {
  const pathname = usePathname();

  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data as User;
    },
  });

  // Fetch pending reminders count for alert badge
  const { data: pendingRemindersCount } = useQuery({
    queryKey: ["pendingReminders", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reminders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .in(
          "invoice_id",
          supabase.from("invoices").select("id").eq("user_id", userId),
        );

      if (error) throw error;
      return count || 0;
    },
  });

  const navigation: NavigationItem[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      name: "Invoices",
      href: "/invoices",
      icon: <FileText className="h-5 w-5" />,
    },
    { name: "Clients", href: "/clients", icon: <Users className="h-5 w-5" /> },
    {
      name: "Reminders",
      href: "/reminders",
      icon: <Mail className="h-5 w-5" />,
      alert: pendingRemindersCount && pendingRemindersCount > 0,
    },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const getInitials = (name: string) => {
    if (!name) return "UN";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold"
        >
          <Mail className="h-6 w-6" />
          <span>Invoice Nudger</span>
        </Link>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                <AvatarFallback>
                  {user ? getInitials(user.full_name || "") : "UN"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.full_name}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {navigation.map((item) => (
              <DropdownMenuItem key={item.name} asChild>
                <Link href={item.href} className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.name}</span>
                  {item.alert && (
                    <AlertCircle className="h-4 w-4 text-red-500 ml-auto" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex">
        {/* Sidebar for desktop */}
        <div className="hidden lg:flex flex-col fixed inset-y-0 z-50 w-64 border-r bg-background">
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <Mail className="h-6 w-6" />
            <span className="font-semibold">Invoice Nudger</span>
          </div>

          <div className="flex-1 overflow-auto py-6">
            <nav className="grid gap-1 px-2">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                    {item.alert && (
                      <AlertCircle className="h-4 w-4 text-red-500 ml-auto" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {user ? getInitials(user.full_name || "") : "UN"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium leading-none">
                  {user?.full_name}
                </p>
                <p className="text-xs truncate text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                    <span className="sr-only">Settings</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 lg:ml-64">
          <main className="container mx-auto p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
