import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Common";

export const Route = createFileRoute("/_app/settings")({
  component: () => <PageHeader title="Settings" subtitle="Deduction points applied automatically to new attendance marks." />,
});