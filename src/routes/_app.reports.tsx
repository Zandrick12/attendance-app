import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Common";

export const Route = createFileRoute("/_app/reports")({
  component: () => <PageHeader title="Reports" subtitle="Generate attendance summaries by class and period." />,
});