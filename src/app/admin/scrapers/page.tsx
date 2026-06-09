import { SCRAPER_JOB_OPTIONS } from "@/lib/admin/scraper-job-options";
import AdminScrapersClient from "./AdminScrapersClient";

export default function AdminScrapersPage() {
  return <AdminScrapersClient jobs={SCRAPER_JOB_OPTIONS} />;
}
