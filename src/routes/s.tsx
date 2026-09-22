import { createFileRoute, redirect } from "@tanstack/react-router";

/** Short link for the student portal. The portal itself stays at /manage. */
export const Route = createFileRoute("/s")({
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/manage", search: { email: search.email, token: search.token } });
  },
  component: () => null,
});
