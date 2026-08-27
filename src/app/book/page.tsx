import { Suspense } from "react";
import { BookClient } from "./BookClient";

export default function BookPage() {
  return (
    <Suspense fallback={<main className="phone px-5 pb-8" />}>
      <BookClient />
    </Suspense>
  );
}
