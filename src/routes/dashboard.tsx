import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: () => <div className="p-8 text-xl">Dashboard works ✅</div>,
});