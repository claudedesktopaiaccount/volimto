import { redirect } from "next/navigation";

export default function AdminLoginRedirect() {
  redirect("/prihlasenie?next=/admin");
}
