"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Modal({
  trigger,
  title,
  children,
  side = false,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  side?: boolean;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={side ? "dialog-content drawer" : "dialog-content"}
        >
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {title} options
          </Dialog.Description>
          <Dialog.Close className="icon-button dialog-close" aria-label="Close">
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Confirm({
  trigger,
  title,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  onConfirm: () => void;
}) {
  return (
    <Modal trigger={trigger} title={title}>
      <p>
        This action cannot be undone. Existing enquiry snapshots will be
        preserved.
      </p>
      <div className="form-actions">
        <Dialog.Close className="button outline">Cancel</Dialog.Close>
        <Dialog.Close className="button danger" onClick={onConfirm}>
          Delete
        </Dialog.Close>
      </div>
    </Modal>
  );
}
