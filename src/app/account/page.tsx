import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { UpdateProfileForm } from "@/components/account/update-profile-form";

export const metadata: Metadata = {
  title: "My Account | Spotted",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: comments }, { data: savedLooks }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("comments")
      .select("id, content, created_at, photos(id, fallback_image_url, celebrities(name, slug))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("saved_looks")
      .select("id, created_at, photos(id, fallback_image_url, celebrities(name, slug))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold mb-8">My Account</h1>

        {/* Profile */}
        <section className="border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
          <UpdateProfileForm
            userId={user.id}
            initialDisplayName={profile?.display_name ?? ""}
          />
        </section>

        {/* Saved Looks */}
        <section className="border rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Saved Looks ({savedLooks?.length ?? 0})
            </h2>
            <Link href="/looks" className="text-xs font-medium hover:underline text-muted-foreground">
              Browse more →
            </Link>
          </div>
          {!savedLooks || savedLooks.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              <p>
                You haven&apos;t saved any looks yet.{" "}
                <Link href="/looks" className="underline font-medium">
                  Browse looks
                </Link>{" "}
                and hit the Save button on any outfit you love.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {savedLooks.map((saved) => {
                const photo = (saved.photos as unknown) as {
                  id: string;
                  fallback_image_url: string | null;
                  celebrities: { name: string; slug: string } | null;
                } | null;
                const celeb = photo?.celebrities;
                if (!photo || !celeb) return null;
                return (
                  <Link
                    key={saved.id}
                    href={`/celebrity/${celeb.slug}/photo/${photo.id}`}
                    className="group"
                    title={celeb.name}
                  >
                    <div className="aspect-[3/4] relative overflow-hidden rounded-lg bg-gray-100">
                      {photo.fallback_image_url ? (
                        <Image
                          src={photo.fallback_image_url}
                          alt={`${celeb.name} look`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 33vw, 16vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No img
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate group-hover:text-foreground transition-colors">
                      {celeb.name}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent comments */}
        <section className="border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">
            My Comments ({comments?.length ?? 0})
          </h2>
          {!comments || comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t commented on any looks yet.{" "}
              <Link href="/" className="underline font-medium">
                Browse looks
              </Link>
            </p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const photo = (comment.photos as unknown) as {
                  id: string;
                  fallback_image_url: string | null;
                  celebrities: { name: string; slug: string } | null;
                } | null;
                const celeb = photo?.celebrities;
                return (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-10 h-14 rounded overflow-hidden bg-gray-100 shrink-0 relative">
                      {photo?.fallback_image_url && (
                        <Image
                          src={photo.fallback_image_url}
                          alt="Look"
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {celeb && photo && (
                        <Link
                          href={`/celebrity/${celeb.slug}/photo/${photo.id}`}
                          className="text-xs font-medium text-muted-foreground hover:underline"
                        >
                          {celeb.name}&apos;s look →
                        </Link>
                      )}
                      <p className="text-sm mt-0.5">{comment.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(comment.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
