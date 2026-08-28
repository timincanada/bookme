import { Brand } from "@/components/Brand";
import { NO_ACCESS_COPY } from "@/lib/admin";

export function Forbidden() {
  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">403</h1>
      <p className="mt-2 text-muted">{NO_ACCESS_COPY}</p>
    </main>
  );
}
