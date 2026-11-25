import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Common";
import { useProfile } from "@/components/AppLayout";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const p = useProfile();
  return <PageHeader title="Dashboard" subtitle={`Welcome, ${p.name}.`} />;
}