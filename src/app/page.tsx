import { getAuth } from "@/lib/auth";
import { Dashboard } from "@/components/Dashboard";
import { SignInPage } from "@/components/SignInPage";
import { AppShell } from "@/components/AppShell";

export default async function Home() {
  const session = await getAuth();

  if (!session?.user?.email) {
    return <SignInPage />;
  }

  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
