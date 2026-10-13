"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, AlertOctagon, CheckCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { markNotificationRead, markAllNotificationsRead, getNotifications } from "@/lib/admin-client";
import type { AdminNotification } from "@/types";

function timeAgo(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
}

export function NotificationsDropdown({
  initialNotifications = [],
}: {
  initialNotifications?: AdminNotification[];
}) {
  const [open, setOpen] = useState(false);
  const [fetchedNotifications, setFetchedNotifications] = useState<AdminNotification[] | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const notifications = fetchedNotifications ?? initialNotifications;
  const updateNotifications = (
    updater: (prev: AdminNotification[]) => AdminNotification[],
  ) => {
    setFetchedNotifications(updater(notifications));
  };

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpen = async () => {
    setOpen((prev) => !prev);
    if (!open) {
      // Refresh notifications from server
      const res = await getNotifications();
      if (res.ok && res.data) {
        setFetchedNotifications(res.data);
      }
    }
  };

  const handleItemClick = async (notif: AdminNotification) => {
    if (!notif.read) {
      updateNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
      );
      await markNotificationRead(notif.id);
    }
    setOpen(false);
    router.push(`/admin/inventory?product=${notif.product_id}`);
  };

  const handleMarkAllRead = async () => {
    setBusy(true);
    updateNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const res = await markAllNotificationsRead();
    setBusy(false);
    if (res.ok) {
      toast.success("All notifications marked as read");
      router.refresh();
    } else {
      toast.error(res.error || "Unable to update notifications");
    }
  };

  return (
    <div className="notifications-dropdown-container" ref={containerRef}>
      <button
        type="button"
        className="icon-button notification-trigger"
        aria-label={`Stock alerts (${unreadCount} unread)`}
        aria-expanded={open}
        onClick={handleOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notifications-popover" role="region" aria-label="Notifications panel">
          <div className="notifications-header">
            <div className="notifications-title-row">
              <span className="notifications-title">Inventory alerts</span>
              {unreadCount > 0 && (
                <span className="notifications-unread-pill">{unreadCount} unread</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="mark-all-read-btn"
                disabled={busy}
                onClick={handleMarkAllRead}
              >
                <CheckCheck size={13} />
                Mark all as read
              </button>
            )}
          </div>

          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="notifications-empty">
                <Bell size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No stock alerts right now.</p>
                <small>Healthy inventory across all sizes and products.</small>
              </div>
            ) : (
              notifications.map((notif) => {
                const isOutOfStock = notif.type === "out_of_stock" || notif.stock_quantity === 0;
                return (
                  <div
                    key={notif.id}
                    className={`notification-item ${notif.read ? "read" : "unread"}`}
                    onClick={() => handleItemClick(notif)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleItemClick(notif);
                      }
                    }}
                  >
                    <div className="notification-icon-wrap">
                      {isOutOfStock ? (
                        <div className="notif-badge-icon out-of-stock" title="Out of stock">
                          <AlertOctagon size={14} />
                        </div>
                      ) : (
                        <div className="notif-badge-icon low-stock" title="Low stock alert">
                          <AlertTriangle size={14} />
                        </div>
                      )}
                    </div>
                    <div className="notification-content">
                      <div className="notification-item-top">
                        <strong className="notification-product-name">
                          {notif.product_name}
                        </strong>
                        <span className="notification-time">{timeAgo(notif.created_at)}</span>
                      </div>
                      <div className="notification-details">
                        <span className="notif-tag size-tag">Size: {notif.size}</span>
                        <span
                          className={`notif-tag ${isOutOfStock ? "out-tag" : "low-tag"}`}
                        >
                          {isOutOfStock
                            ? "Out of stock (0 units)"
                            : `Low stock (${notif.stock_quantity} left)`}
                        </span>
                      </div>
                    </div>
                    {!notif.read && <span className="unread-dot" title="Unread" />}
                  </div>
                );
              })
            )}
          </div>

          <div className="notifications-footer">
            <Link
              href="/admin/inventory"
              className="view-inventory-link"
              onClick={() => setOpen(false)}
            >
              <span>Manage all inventory</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
