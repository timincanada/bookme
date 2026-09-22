import { createFileRoute } from "@tanstack/react-router";
import { CoachPage } from "@/components/bookme/public-coach";
import { getPublicCoach } from "@/lib/bookme/api";

export const Route = createFileRoute("/c/$slug")({
  loader: async ({ params }) => {
    const coach = await getPublicCoach({ data: { slug: params.slug } });
    return { coach };
  },
  component: ShortSlugPage,
});

function ShortSlugPage() {
  const { slug } = Route.useParams();
  const { coach } = Route.useLoaderData();
  return <CoachPage initialCoach={coach} slug={slug} />;
}
