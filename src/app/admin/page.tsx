import { Brand } from "@/components/Brand";
import { Forbidden } from "@/components/Forbidden";
import { staffAdminView } from "@/lib/admin";
import { currentCoach, currentStaff, ensureStaff } from "@/lib/session";
import { AdminList } from "./AdminList";
import { StaffSignIn } from "./StaffSignIn";
import { StaffSignOut } from "./StaffSignOut";

export default async function StaffAdminPage() {
  await ensureStaff();
  const coach = await currentCoach();
  const staff = coach ? null : await currentStaff();
  const view = staffAdminView(Boolean(coach), Boolean(staff));

  if (view === "403") return <Forbidden />;

  if (view === "login") {
    return (
      <main className="phone px-5 pb-8">
        <Brand />
        <StaffSignIn />
      </main>
    );
  }

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Coaches</h1>
        <StaffSignOut />
      </div>
      <AdminList />
    </main>
  );
}
