import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { AddCelebrityForm } from "@/components/admin/add-celebrity-form";

export default async function AdminCelebritiesPage() {
  const supabase = await createClient();
  const { data: celebrities } = await supabase
    .from("celebrities")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Celebrities</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* List */}
        <div>
          <h2 className="text-lg font-semibold mb-4">All celebrities</h2>
          {!celebrities || celebrities.length === 0 ? (
            <p className="text-muted-foreground text-sm">No celebrities yet.</p>
          ) : (
            <div className="space-y-2">
              {celebrities.map((celeb) => (
                <div
                  key={celeb.id}
                  className="flex items-center gap-3 border rounded-lg p-3"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0 relative">
                    {celeb.image_url ? (
                      <Image
                        src={celeb.image_url}
                        alt={celeb.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                        {celeb.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{celeb.name}</p>
                    <p className="text-xs text-muted-foreground">{celeb.slug}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add form */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Add new celebrity</h2>
          <AddCelebrityForm />
        </div>
      </div>
    </div>
  );
}
