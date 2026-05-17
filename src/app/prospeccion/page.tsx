// Default route: redirect to inbox
import { redirect } from "next/navigation";

export default function ProspeccionPage() {
  redirect("/prospeccion/inbox");
}
