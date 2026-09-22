import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/schedule")({ component: () => <Navigate to="/app" /> });
