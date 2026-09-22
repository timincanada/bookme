import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in")({ component: SignInRedirect });

function SignInRedirect() {
  return <Navigate to="/login" />;
}
