// Adapted from shadcn/ui sidebar (MIT): provider, responsive sheet, icon collapse,
// keyboard shortcut and state contract. Application-only styling is in trainer-admin.css.
import * as React from "react";
import { PanelLeft } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, Sheet } from "./primitives";
const SidebarContext = React.createContext<null | {
  open: boolean;
  state: "expanded" | "collapsed";
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (v: boolean) => void;
  toggleSidebar: () => void;
}>(null);
export function useSidebar() {
  const value = React.useContext(SidebarContext);
  if (!value) throw new Error("SidebarProvider required");
  return value;
}
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true),
    [openMobile, setOpenMobile] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(
    () => matchMedia("(max-width: 1023px)").matches,
  );
  React.useEffect(() => {
    const q = matchMedia("(max-width: 1023px)");
    const update = () => {
      setIsMobile(q.matches);
      setOpenMobile(false);
    };
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  const toggleSidebar = React.useCallback(
    () => (isMobile ? setOpenMobile((v) => !v) : setOpen((v) => !v)),
    [isMobile],
  );
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);
  return (
    <SidebarContext.Provider
      value={{
        open,
        state: open ? "expanded" : "collapsed",
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }}
    >
      <Tooltip.Provider delayDuration={200}>
        <div
          data-slot="sidebar-wrapper"
          data-state={open ? "expanded" : "collapsed"}
          className="nfc-admin nfc-admin-layout"
        >
          {children}
        </div>
      </Tooltip.Provider>
    </SidebarContext.Provider>
  );
}
export function Sidebar({ children }: { children: React.ReactNode }) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  return isMobile ? (
    <Sheet
      title="Antrenör menüsü"
      open={openMobile}
      onOpenChange={setOpenMobile}
    >
      <aside data-slot="sidebar" data-mobile="true">
        {children}
      </aside>
    </Sheet>
  ) : (
    <aside data-slot="sidebar" data-state={state}>
      {children}
    </aside>
  );
}
export function SidebarTrigger() {
  const { toggleSidebar, open, isMobile } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        isMobile ? "Menüyü aç" : open ? "Menüyü daralt" : "Menüyü genişlet"
      }
      onClick={toggleSidebar}
    >
      <PanelLeft size={20} />
    </Button>
  );
}
export function SidebarMenuButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { open, isMobile, setOpenMobile } = useSidebar();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Button
          variant="ghost"
          data-slot="sidebar-menu-button"
          data-active={active}
          aria-current={active ? "page" : undefined}
          aria-label={label}
          onClick={() => {
            onClick();
            if (isMobile) setOpenMobile(false);
          }}
        >
          {children}
          <span className="nfc-nav-label">{label}</span>
        </Button>
      </Tooltip.Trigger>
      {!open && !isMobile && (
        <Tooltip.Portal>
          <Tooltip.Content side="right" className="nfc-admin nfc-tooltip">
            {label}
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Portal>
      )}
    </Tooltip.Root>
  );
}
