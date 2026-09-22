import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/bookme/public-coach";
import { getPublicCoach } from "@/lib/bookme/api";
import { DEMO_COACH } from "@/lib/bookme/demo";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const slug = params.slug === "preview" ? DEMO_COACH.slug : params.slug;
    const coach = await getPublicCoach({ data: { slug } });
    return { coach, slug };
  },
  pendingComponent: OpeningPage,
  component: SlugPage,
});

function OpeningPage() {
  return <main className="min-h-screen bg-paper px-5 py-16 text-muted">Opening the booking page…</main>;
}

function SlugPage() {
  const { coach, slug } = Route.useLoaderData();
  return <CoachPage initialCoach={coach} slug={slug} />;
}
