import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEMO_COACH } from "@/lib/bookme/demo";

export const Route = createFileRoute("/preview")({
  beforeLoad: () => {
    throw redirect({ to: "/$slug", params: { slug: DEMO_COACH.slug } });
  },
  component: () => null,
});
