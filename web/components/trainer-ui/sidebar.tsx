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
  sidebarId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  setOpenMobile: (v: boolean) => void;
  toggleSidebar: () => void;
}>(null);
export function useSidebar() {
  const value = React.useContext(SidebarContext);
  if (!value) throw new Error("SidebarProvider required");
  return value;
}
export function SidebarProvider({ children, storageKey = "nfcfit:trainer:sidebar", className = "" }: { children: React.ReactNode; storageKey?: string; className?: string }) {
  const sidebarId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(() => {
    try { return localStorage.getItem(storageKey) !== "collapsed"; }
    catch { return true; }
  }),
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
    try { localStorage.setItem(storageKey, open ? "expanded" : "collapsed"); }
    catch { /* Navigation remains usable when storage is unavailable. */ }
  }, [open, storageKey]);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (!e.repeat && e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey)) {
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
        sidebarId,
        triggerRef,
        setOpenMobile,
        toggleSidebar,
      }}
    >
      <Tooltip.Provider delayDuration={200}>
        <div
          data-slot="sidebar-wrapper"
          data-state={open ? "expanded" : "collapsed"}
          className={`nfc-admin nfc-admin-layout ${className}`}
        >
          {children}
        </div>
      </Tooltip.Provider>
    </SidebarContext.Provider>
  );
}
export function Sidebar({ children, title = "Antrenör menüsü" }: { children: React.ReactNode; title?: string }) {
  const { isMobile, state, openMobile, setOpenMobile, sidebarId, triggerRef } = useSidebar();
  return isMobile ? (
    <Sheet
      title={title}
      open={openMobile}
      onOpenChange={setOpenMobile}
      onCloseAutoFocus={(event) => {
        if (triggerRef.current?.isConnected) {
          event.preventDefault();
          triggerRef.current.focus();
        }
      }}
    >
      <aside id={sidebarId} data-slot="sidebar" data-mobile="true">
        {children}
      </aside>
    </Sheet>
  ) : (
    <aside id={sidebarId} data-slot="sidebar" data-state={state}>
      {children}
    </aside>
  );
}
export function SidebarTrigger() {
  const { toggleSidebar, open, isMobile, openMobile, sidebarId, triggerRef } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      ref={triggerRef}
      aria-expanded={isMobile ? openMobile : open}
      aria-controls={sidebarId}
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
