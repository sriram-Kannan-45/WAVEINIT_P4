"use client";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shirt,
  Tags,
  FolderTree,
  Layers3,
  Boxes,
  MessageCircle,
  PanelsTopLeft,
  Settings,
  FileText,
  User,
  LogOut,
  ArrowUpRight,
  Menu,
  Sparkles,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Modal } from "@/components/ui/dialog";
import { logout } from "@/app/admin/actions";
import { clearAccessToken, restoreSession, getAccessToken } from "@/lib/admin-client";
import { NotificationsDropdown } from "./notifications-dropdown";
import type { AdminNotification } from "@/types";
const routes = [
  ["Dashboard", "dashboard", LayoutDashboard],
  ["Products", "products", Shirt],
  ["Categories", "categories", Tags],
  ["Subcategories", "subcategories", FolderTree],
  ["Collections", "collections", Layers3],
  ["New arrivals", "new-arrivals", Sparkles],
  ["Inventory", "inventory", Boxes],
  ["Order enquiries", "orders", MessageCircle],
  ["Homepage", "homepage", PanelsTopLeft],
  ["Store settings", "settings", Settings],
  ["Policies", "policies", FileText],
  ["Account", "account", User],
] as const;
function Sidebar({ drawer = false }: { drawer?: boolean }) {
  const pathname = usePathname();

  const brandLink = (
    <Link href="/admin/dashboard" className="brand">
      <Image
        src="/brand/achu-designer-boutique-logo.png"
        style={{ height: "auto" }}
        width={56}
        height={60}
        alt="Achu official logo"
      />
      <span>
        <strong>Achu</strong>
        <small>OWNER’S SPACE</small>
      </span>
    </Link>
  );

  return (
    <aside className={`admin-sidebar ${drawer ? "in-drawer" : ""}`}>
      {drawer ? (
        <Dialog.Close asChild>{brandLink}</Dialog.Close>
      ) : (
        brandLink
      )}
      <nav aria-label="Owner navigation">
        {routes.map(([name, path, Icon]) => {
          const item = (
            <Link
              key={path}
              href={`/admin/${path}`}
              className={pathname.includes(`/admin/${path}`) ? "active" : ""}
            >
              <Icon size={16} />
              {name}
            </Link>
          );
          return drawer ? (
            <Dialog.Close asChild key={path}>
              {item}
            </Dialog.Close>
          ) : (
            item
          );
        })}
      </nav>
      <div className="admin-sidebar-footer">
        <Link href="/" target="_blank">
          View your boutique <ArrowUpRight size={15} />
        </Link>
        <form
          action={logout}
          onSubmit={() => {
            clearAccessToken();
          }}
        >
          <button>
            <LogOut size={15} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
export function AdminShell({
  children,
  initialNotifications = [],
}: {
  children: React.ReactNode;
  initialNotifications?: AdminNotification[];
}) {
  useEffect(() => {
    if (!getAccessToken()) {
      restoreSession();
    }
  }, []);

  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-content">
        <div className="admin-topbar">
          <div className="admin-topbar-left">
            <span>ACHU DESIGNER BOUTIQUE · OWNER’S SPACE</span>
          </div>
          <div className="admin-topbar-right">
            <NotificationsDropdown initialNotifications={initialNotifications} />
            <div className="admin-mobile-trigger">
              <Modal
                side
                title="Manage your boutique"
                trigger={
                  <button
                    className="icon-button"
                    aria-label="Open owner navigation"
                  >
                    <Menu size={20} />
                  </button>
                }
              >
                <Sidebar drawer />
              </Modal>
            </div>
            <span className="desktop-filter">Your collection. Your control.</span>
          </div>
        </div>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
