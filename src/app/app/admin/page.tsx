import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { currentCoach } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { AdminList } from "./AdminList";

export default async function AdminPage() {
  const coach = await currentCoach();
  if (!coach) redirect("/app/login");
  if (!isAdminEmail(coach.email)) {
    return (
      <main className="phone px-5 pb-8">
        <Brand />
        <h1 className="text-2xl font-bold">Not allowed</h1>
      </main>
    );
  }
  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Coaches</h1>
      <AdminList />
    </main>
  );
}
