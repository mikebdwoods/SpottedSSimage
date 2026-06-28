import { redirect } from "next/navigation";
import Link from "next/link";
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

  const [{ data: profile }, { data: comments }] = await Promise.all([
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
  ]);

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="mx-auto max-w-2xl">
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
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.fallback_image_url}
                          alt="Look"
                          className="w-full h-full object-cover"
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
