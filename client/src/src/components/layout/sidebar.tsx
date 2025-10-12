"use client";

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Home,
  Briefcase,
  FileText,
  ClipboardList,
  Truck,
  Wrench,
  DollarSign,
  Layers,
} from "lucide-react";

const menuItems = [
  { href: "/", label: "Painel", icon: Home },
  { href: "/empreendimentos", label: "Empreendimentos", icon: Briefcase },
  { href: "/licencas/ativas", label: "Licenças", icon: FileText },
  { href: "/demandas", label: "Demandas", icon: ClipboardList },
  { href: "/frota", label: "Frota", icon: Truck },
  { href: "/equipamentos", label: "Equipamentos", icon: Wrench },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/painel", label: "Painel Integrado", icon: Layers },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className={cn(
        "h-screen bg-primary text-primary-foreground transition-all duration-300 border-r border-border flex flex-col items-center py-4",
        open ? "w-56" : "w-16"
      )}
    >
      {menuItems.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>
              <Link
                href={href}
                className={cn(
                  "flex items-center w-full px-3 py-2 rounded-md transition-all",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-secondary/30"
                )}
              >
                <Icon className="h-5 w-5" />
                {open && <span className="ml-3 text-sm font-medium">{label}</span>}
              </Link>
            </TooltipTrigger>
            {!open && <TooltipContent side="right">{label}</TooltipContent>}
          </Tooltip>
        );
      })}
    </aside>
  );
}
