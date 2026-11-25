import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Common";

export const Route = createFileRoute("/_app/attendance/$cls")({ component: AttendancePage });

function AttendancePage() {
  const { cls } = Route.useParams();
  return (
    <PageHeader title={`${cls} Attendance`} subtitle="Create a session, mark cadets, then mark it as done." />
  );
}