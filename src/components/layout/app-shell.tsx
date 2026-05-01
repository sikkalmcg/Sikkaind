
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  MapPin, 
  LogOut, 
  Package, 
  Menu,
  Bell,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: PlusCircle, label: "New Shipment", href: "/shipments/new" },
  { icon: MapPin, label: "Live Tracking", href: "/shipments/tracking" },
  { icon: History, label: "Shipment History", href: "/shipments/history" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="h-16 flex items-center px-6 border-b border-sidebar-border">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Package className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="font-headline font-bold text-xl tracking-tight group-data-[collapsible=icon]:hidden">
                CargoFlow
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent className="px-3 py-4">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    className={cn(
                      "transition-all duration-200",
                      pathname === item.href ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex items-center gap-3 px-2 py-2 group-data-[collapsible=icon]:hidden">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">John Doe</span>
                    <span className="text-xs text-sidebar-foreground/60">Logistics Manager</span>
                  </div>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Logout">
                  <Link href="/auth/login">
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <div className="hidden md:flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md w-64">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search shipments..." 
                  className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-background" />
              </Button>
              <Button size="sm" className="hidden sm:flex gap-2">
                <PlusCircle className="w-4 h-4" />
                Quick Shipment
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
