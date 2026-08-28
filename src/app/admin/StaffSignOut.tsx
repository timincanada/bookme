"use client";

export function StaffSignOut() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        window.location.reload();
      }}
      className="text-sm font-semibold"
    >
      Sign out
    </button>
  );
}
