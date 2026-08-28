import { Brand } from "@/components/Brand";

export default function CoachAdminForbidden() {
  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">403</h1>
      <p className="mt-2 text-muted">You don't have access</p>
    </main>
  );
}
