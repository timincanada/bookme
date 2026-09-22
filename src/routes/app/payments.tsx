import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/payments")({ component: () => <Navigate to="/app/billing" /> });
