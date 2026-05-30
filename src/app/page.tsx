import { getAuth } from "@/lib/auth";
import { getCreativesPage, getSyncState, getGlobalRole } from "@/lib/db-queries";
import { supabase } from "@/lib/supabase";
import { Dashboard } from "@/components/Dashboard";
import { SignInPage } from "@/components/SignInPage";
import { AppShell } from "@/components/AppShell";

const PAGE_SIZE = 50;

export default async function Home() {
  const session = await getAuth();

  if (!session?.user?.email) {
    return <SignInPage />;
  }

  const email = session.user.email;

  // Fetch initial data server-side so the first render is instant (no loading spinner)
  let initialData;
  try {
    const [globalRole, syncState] = await Promise.all([
      getGlobalRole(email),
      getSyncState(),
    ]);

    if (globalRole) {
      let allowedProjectIds: string[] | null = null;
      if (globalRole !== "admin") {
        const { data: memberships } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("email", email);
        allowedProjectIds = (memberships ?? []).map((r) => r.project_id as string);
      }

      const { creatives, total, folders } = await getCreativesPage({
        limit: PAGE_SIZE,
        allowedProjectIds,
      });

      initialData = {
        files: creatives,
        folders,
        total,
        nextOffset: creatives.length === PAGE_SIZE ? PAGE_SIZE : null,
        syncState: syncState ?? null,
      };
    }
  } catch {
    // Si falla el fetch inicial, el Dashboard lo intenta desde el cliente normalmente
  }

  return (
    <AppShell>
      <Dashboard initialData={initialData} />
    </AppShell>
  );
}
