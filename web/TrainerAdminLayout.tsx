import { TrainerHeaderActionContext } from "./components/trainer-ui/page-actions";
import React from "react";
import {
  LayoutDashboard,
  ListTodo,
  Users,
  CalendarDays,
  Dumbbell,
  Library,
  ChartNoAxesCombined,
  MessageSquare,
  RefreshCw,
  Activity,
  CircleHelp,
} from "lucide-react";
import { Toaster } from "sonner";
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarMenuButton,
} from "./components/trainer-ui/sidebar";
import { Button, Badge } from "./components/trainer-ui/primitives";
import "./trainer-utilities.css";
import "./trainer-admin.css";
import "./trainer-density.css";
import "./trainer-daily.css";
export const trainerPages = [
  {
    key: "dashboard",
    label: "Genel bakış",
    icon: LayoutDashboard,
    description: "Üyelerinin programlarını ve son antrenmanlarını takip et.",
  },
  {key:"attention",label:"İlgi bekleyenler",icon:ListTodo,description:"Takip nedenini gör, ilgili adıma doğrudan geç."},
  {
    key: "athletes",
    label: "Üyelerim",
    icon: Users,
    description: "Sana atanmış üyeleri incele ve programlarını yönet.",
  },
  {
    key: "plans",
    label: "Programlar",
    icon: CalendarDays,
    description: "Haftaları planla, programları yayınla ve üyelerine ata.",
  },
  {
    key: "workouts",
    label: "Antrenmanlar",
    icon: Dumbbell,
    description: "Tekrar kullanabileceğin antrenman şablonlarını düzenle.",
  },
  {
    key: "exercises",
    label: "Egzersiz kütüphanesi",
    icon: Library,
    description: "Hareketleri, ekipmanları ve uygulama talimatlarını keşfet.",
  },
  {
    key: "reports",
    label: "İlerleme",
    icon: ChartNoAxesCombined,
    description: "Planlanan, tamamlanan ve ekstra setleri karşılaştır.",
  },
  {
    key: "messages",
    label: "Mesajlar",
    icon: MessageSquare,
    description: "Üyelerinle program ve antrenmanlar hakkında iletişim kur.",
  },
];
export default function TrainerAdminLayout({
  tab,
  navigate,
  busy,
  refresh,
  editor,
  primaryAction,
  children,
}: {
  tab: string;
  navigate: (key: string) => void;
  busy: boolean;
  refresh: () => void;
  editor: boolean;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [headerActionNode, setHeaderActionNode] =
    React.useState<HTMLElement | null>(null);
  const page = trainerPages.find((p) => p.key === tab) ?? trainerPages[0];
  return (
    <TrainerHeaderActionContext.Provider value={headerActionNode}>
      <SidebarProvider>
        <Sidebar>
          <div className="nfc-sidebar-brand">
            <span className="nfc-brand-icon">
              <Activity size={22} />
            </span>
            <div className="nfc-nav-label">
              <strong>NFCFit</strong>
              <small>Antrenör çalışma alanı</small>
            </div>
          </div>
          <div className="nfc-sidebar-content">
            <p className="nfc-nav-label nfc-sidebar-caption">ÇALIŞMA ALANI</p>
            <nav aria-label="Antrenör bölümleri">
              {trainerPages.map(({ key, label, icon: Icon }) => (
                <SidebarMenuButton
                  key={key}
                  label={label}
                  active={tab === key}
                  onClick={() => navigate(key)}
                >
                  <Icon size={19} />
                </SidebarMenuButton>
              ))}
            </nav>
          </div>
          <div className="nfc-sidebar-footer">
            <CircleHelp size={18} />
            <p className="nfc-nav-label">
              Yalnızca kulübünde sana atanmış üyeler görünür.
            </p>
          </div>
        </Sidebar>
        <div className="nfc-admin-main" data-editor={editor}>
          <header className="nfc-page-header">
            <div className="nfc-page-breadcrumb">
              <SidebarTrigger />
              <span>Antrenör</span>
              <span aria-hidden>/</span>
              <strong>{page.label}</strong>
            </div>
            <div className="nfc-header-actions">
              <Badge>Çalışma alanı</Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Yenile"
                disabled={busy}
                onClick={refresh}
              >
                <RefreshCw size={18} className={busy ? "nfc-spin" : ""} />
              </Button>
            </div>
          </header>
          <div className="nfc-page-content">
            {!editor && (
              <div className="nfc-page-title">
                <div>
                  <h2>{page.label}</h2>
                  <p>{page.description}</p>
                </div>
                {primaryAction}
                <div
                  className="nfc-header-action-slot"
                  ref={setHeaderActionNode}
                />
              </div>
            )}
            {children}
          </div>
        </div>
        <Toaster
          theme="dark"
          richColors
          closeButton
          position="top-right"
          toastOptions={{ className: "nfc-admin" }}
        />
      </SidebarProvider>
    </TrainerHeaderActionContext.Provider>
  );
}
