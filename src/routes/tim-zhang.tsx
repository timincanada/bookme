import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/tim-zhang")({
  component: () => <Navigate to="/$slug" params={{ slug: "tim-zhang" }} />,
});
