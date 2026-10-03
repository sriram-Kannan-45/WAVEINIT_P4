"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shirt,
  Tags,
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
} from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { logout } from "@/app/admin/actions";
const routes = [
  ["Dashboard", "dashboard", LayoutDashboard],
  ["Products", "products", Shirt],
  ["Categories", "categories", Tags],
  ["Collections", "collections", Layers3],
  ["Inventory", "inventory", Boxes],
  ["Order enquiries", "orders", MessageCircle],
  ["Homepage", "homepage", PanelsTopLeft],
  ["Store settings", "settings", Settings],
  ["Policies", "policies", FileText],
  ["Account", "account", User],
] as const;
function Sidebar({ drawer = false }: { drawer?: boolean }) {
  const pathname = usePathname();
  return (
    <aside className={`admin-sidebar ${drawer ? "in-drawer" : ""}`}>
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
      <nav aria-label="Owner navigation">
        {routes.map(([name, path, Icon]) => (
          <Link
            key={path}
            href={`/admin/${path}`}
            className={pathname.includes(`/admin/${path}`) ? "active" : ""}
          >
            <Icon size={16} />
            {name}
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <Link href="/" target="_blank">
          View your boutique <ArrowUpRight size={15} />
        </Link>
        <form action={logout}>
          <button>
            <LogOut size={15} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-content">
        <div className="admin-topbar">
          <span>ACHU DESIGNER BOUTIQUE · OWNER’S SPACE</span>
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
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
