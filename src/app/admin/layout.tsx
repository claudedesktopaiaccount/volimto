import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isAdminAuthedFromCookies } from "@/lib/admin-auth";

interface Props {
  children: ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  const authed = await isAdminAuthedFromCookies();
  if (!authed) redirect("/prihlasenie?next=/admin");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between border-b border-divider pb-4">
        <a href="/admin" className="font-serif text-xl font-bold text-ink">
          VolímTo Admin
        </a>
        <form action="/admin/logout" method="post">
          <button type="submit" className="text-sm text-muted hover:text-ink">
            Odhlásiť
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
