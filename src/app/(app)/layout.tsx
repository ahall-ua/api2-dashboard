import { redirect } from "next/navigation";
import { getSession, isAuthenticated } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { TokenRefresher } from "@/components/token-refresher";
import { GeocitiesEffect } from "@/components/geocities-effect";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const session = await getSession();

  return (
    <div className="flex flex-col flex-1">
      <TokenRefresher />
      <GeocitiesEffect />
      <AppNav username={session.username} env={session.env || "prod"} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
