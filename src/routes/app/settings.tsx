import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/settings")({ component: () => <Navigate to="/app/more" /> });
