import { createClient } from "@/lib/supabase/server";
import { InviteAdminForm } from "@/components/admin/invite-admin-form";
import { DeleteInviteButton } from "@/components/admin/delete-invite-button";
import { UserRoleToggle } from "@/components/admin/user-role-toggle";
import { UserStatusActions } from "@/components/admin/user-status-actions";

export const metadata = { title: "Users | Admin" };

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string | null;
  banned_until: string | null;
  is_admin: boolean;
};

type PendingInvite = {
  email: string;
  role: string;
  invited_at: string;
  invited_by: string | null;
};

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const [{ data: users, error: usersError }, { data: invites, error: invitesError }] =
    await Promise.all([
      supabase.rpc("admin_list_users") as unknown as Promise<{
        data: AdminUser[] | null;
        error: { message: string } | null;
      }>,
      supabase.rpc("admin_list_invites") as unknown as Promise<{
        data: PendingInvite[] | null;
        error: { message: string } | null;
      }>,
    ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {users?.length ?? 0} accounts · manage admin access, invites and account status
        </p>
      </div>

      <div className="border rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold mb-1">Invite an admin</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Invited emails are automatically granted the chosen role the first time they sign up.
        </p>
        <InviteAdminForm />
      </div>

      {invitesError && (
        <p className="text-destructive text-sm mb-4">{invitesError.message}</p>
      )}

      {invites && invites.length > 0 && (
        <div className="border rounded-lg overflow-hidden divide-y mb-8">
          <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-muted-foreground">
            Pending invites
          </div>
          {invites.map((invite) => (
            <div
              key={invite.email}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{invite.email}</p>
                <p className="text-xs text-muted-foreground">
                  Role: {invite.role} · invited {fmtDate(invite.invited_at)}
                </p>
              </div>
              <DeleteInviteButton email={invite.email} />
            </div>
          ))}
        </div>
      )}

      {usersError ? (
        <p className="text-destructive text-sm">{usersError.message}</p>
      ) : !users || users.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <p>No users yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {users.map((u) => {
            const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date();
            const isSelf = u.id === currentUser?.id;
            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{u.email}</span>
                    {u.is_admin && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-clay-soft text-clay-soft-foreground px-2 py-0.5 rounded-full">
                        Admin
                      </span>
                    )}
                    {isBanned && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        Deactivated
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Joined {fmtDate(u.created_at)} · last sign-in {fmtDate(u.last_sign_in_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <UserRoleToggle userId={u.id} isAdmin={u.is_admin} disabled={isSelf} />
                  <UserStatusActions userId={u.id} isBanned={isBanned} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
