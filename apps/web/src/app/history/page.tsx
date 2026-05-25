import { redirect } from "next/navigation";

/** History merged into Gallery; keep old links working. */
export default function HistoryRedirectPage() {
  redirect("/gallery");
}
