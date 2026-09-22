import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/calendar")({ component: () => <Navigate to="/app" /> });
