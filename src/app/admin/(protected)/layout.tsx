import { requireAdmin } from "@/lib/supabase/server";
import { adminNotifications } from "@/lib/admin-data";
import { AdminShell } from "@/components/admin/shell";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Owner dashboard",
  robots: { index: false, follow: false },
};
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const notifications = await adminNotifications();
  return <AdminShell initialNotifications={notifications}>{children}</AdminShell>;
}
