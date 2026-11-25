import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Common";

export const Route = createFileRoute("/_app/history")({
  component: () => <PageHeader title="Attendance History" subtitle="All attendance sessions across every class." />,
});