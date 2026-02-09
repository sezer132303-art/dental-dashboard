import DashboardLayout from '../(dashboard)/layout'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Reuse the dashboard layout for admin pages
  return <DashboardLayout>{children}</DashboardLayout>
}
