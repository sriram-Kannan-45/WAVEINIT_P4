"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function AdminModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = "720px",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
  isDirty?: boolean;
}) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog.Root
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay admin-modal-overlay" />
        <Dialog.Content
          className="dialog-content admin-modal-content"
          style={{ "--modal-max-width": maxWidth } as React.CSSProperties}
          onPointerDownOutside={(e) => {
            // If image cropper modal or another dialog overlay is present, prevent closing
            if (
              document.querySelector(".cropper-backdrop") ||
              document.querySelector(".dialog-content:not(.admin-modal-content)")
            ) {
              e.preventDefault();
              return;
            }
            handleClose();
          }}
          onEscapeKeyDown={(e) => {
            // Let the active cropper or nested dialog handle escape first
            if (document.querySelector(".cropper-backdrop")) {
              e.preventDefault();
              return;
            }
            handleClose();
          }}
        >
          <div className="admin-modal-header">
            <div>
              <Dialog.Title className="admin-modal-title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="admin-modal-description">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  {title} dialog
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button admin-modal-close"
                aria-label="Close dialog"
                onClick={handleClose}
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <div className="admin-modal-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
