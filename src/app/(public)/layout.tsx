import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { getSessionUser } from '@/lib/auth';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader user={user} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
