import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Common";

export const Route = createFileRoute("/_app/officers")({
  component: () => <PageHeader title="Officers" subtitle="Officer accounts and the system audit log." />,
});