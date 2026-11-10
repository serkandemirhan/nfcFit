import React from "react";
import { Activity, Building2, CalendarDays, CreditCard, Dumbbell, LayoutDashboard, Library, Settings, ShieldCheck, Users, UsersRound } from "lucide-react";
import { Sidebar, SidebarMenuButton, SidebarProvider, SidebarTrigger } from "./components/trainer-ui/sidebar";
import "./trainer-admin.css";
import "./facility-admin.css";

export type FacilitySection = { id: string; label: string };
export type WorkspaceAction = { id: "platform" | "facility" | "coaching"; label: string; active: boolean; onSelect: () => void };
const icons: Record<string, typeof Users> = {
  overview: LayoutDashboard, members: Users, tags: CreditCard, equipment: Dumbbell,
  exercises: Library, staff: UsersRound, activity: Activity, administration: Settings,
  platform: ShieldCheck, facility: Building2, coaching: CalendarDays,
};

export default function FacilityAdminLayout({ sections, selected, navigate, tenantName, summary, accountControls, workspaces, messages, children }: {
  sections: FacilitySection[]; selected: string; navigate: (id: string) => void;
  tenantName: string; summary: string; accountControls: React.ReactNode;
  workspaces: WorkspaceAction[]; messages: React.ReactNode; children: React.ReactNode;
}) {
  const current = sections.find((section) => section.id === selected);
  return <SidebarProvider storageKey="nfcfit:facility:sidebar" className="nfc-facility">
    <Sidebar title="Tesis menüsü">
      <div className="nfc-sidebar-brand">
        <span className="nfc-brand-icon" title={tenantName}><Building2 size={22} /></span>
        <div className="nfc-nav-label"><strong>NFCFit</strong><small title={tenantName}>{tenantName}</small></div>
      </div>
      <div className="nfc-sidebar-content">
        <p className="nfc-nav-label nfc-sidebar-caption">TESİS YÖNETİMİ</p>
        <nav aria-label="Tesis bölümleri">{sections.map((section) => {
          const Icon = icons[section.id] ?? Building2;
          return <SidebarMenuButton key={section.id} label={section.label} active={selected === section.id} onClick={() => navigate(section.id)}><Icon size={19} /></SidebarMenuButton>;
        })}</nav>
      </div>
      {!!workspaces.length && <div className="nfc-sidebar-footer facility-workspaces"><nav aria-label="Çalışma alanı">{workspaces.map((workspace) => {
        const Icon = icons[workspace.id];
        return <SidebarMenuButton key={workspace.id} label={workspace.label} active={workspace.active} onClick={workspace.onSelect}><Icon size={19} /></SidebarMenuButton>;
      })}</nav></div>}
    </Sidebar>
    <div className="nfc-admin-main">
      <header className="nfc-page-header facility-header">
        <div className="nfc-page-breadcrumb"><SidebarTrigger /><span>Tesis yönetimi</span><span aria-hidden>/</span><strong>{current?.label}</strong></div>
        <div className="facility-account-controls">{accountControls}</div>
      </header>
      <div className="nfc-page-content facility-content">
        <div className="nfc-page-title facility-page-title"><h1>{current?.label}</h1><p>{summary}</p></div>
        {messages}
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  </SidebarProvider>;
}
