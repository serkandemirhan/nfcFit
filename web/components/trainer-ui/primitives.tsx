// Adapted from shadcn/ui (MIT). Scoped CSS replaces upstream Tailwind utilities.
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { X } from "lucide-react";
export const cn = clsx;
export const buttonVariants = cva("nfc-button", {
  variants: {
    variant: {
      default: "nfc-primary",
      outline: "nfc-outline",
      ghost: "nfc-ghost",
      destructive: "nfc-destructive",
    },
    size: { default: "", icon: "nfc-icon" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn("nfc-input", className)}
      {...props}
    />
  );
}
export function Label(props: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" {...props} />;
}
export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="badge" className={cn("nfc-badge", className)} {...props} />
  );
}
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container">
      <table data-slot="table" className={className} {...props} />
    </div>
  );
}
export function TableHeader(props: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" {...props} />;
}
export function TableBody(props: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" {...props} />;
}
export function TableRow(props: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" {...props} />;
}
export function TableHead(props: React.ComponentProps<"th">) {
  return <th data-slot="table-head" {...props} />;
}
export function TableCell(props: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" {...props} />;
}
export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({
  className,
  children,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  overlayClassName?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn("nfc-admin nfc-dialog-overlay", overlayClassName)}
      />
      <DialogPrimitive.Content
        className={cn("nfc-admin nfc-dialog-content", className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export function Sheet({
  title,
  open,
  onOpenChange,
  children,
  onCloseAutoFocus,
}: {
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  onCloseAutoFocus?: React.ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="nfc-sheet" aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <div className="nfc-sheet-heading">
          <DialogTitle>{title}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Menüyü kapat">
              <X size={20} />
            </Button>
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
// shadcn/ui Native Select: browser keyboard and platform select semantics retained.
export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn("nfc-native-select", className)}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
