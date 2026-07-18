import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Temporary diagnostic function - confirms AWIN_API_TOKEN / AWIN_PUBLISHER_ID
// are set and the token works, and lists joined programmes (merchants) so we
// know what's actually available to sync. Delete once sync_products exists.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let overridePublisherId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.publisher_id_override === "string") overridePublisherId = body.publisher_id_override;
  } catch {
    // no body
  }

  const token = Deno.env.get("AWIN_API_TOKEN");
  const publisherId = overridePublisherId ?? Deno.env.get("AWIN_PUBLISHER_ID");

  if (!token) {
    return json({ error: "Missing AWIN_API_TOKEN" }, 400);
  }

  try {
    // No publisher ID yet - discover the account(s) this token belongs to.
    const accountsRes = await fetch("https://api.awin.com/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const accountsText = await accountsRes.text();
    let accounts: unknown;
    try {
      accounts = JSON.parse(accountsText);
    } catch {
      accounts = accountsText.slice(0, 2000);
    }

    let programmes: unknown = null;
    if (publisherId) {
      const res = await fetch(`https://api.awin.com/publishers/${publisherId}/programmes?relationship=joined`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      try {
        programmes = { status: res.status, body: JSON.parse(text) };
      } catch {
        programmes = { status: res.status, body: text.slice(0, 2000) };
      }
    }

    return json({
      has_publisher_id: !!publisherId,
      accounts_status: accountsRes.status,
      accounts,
      programmes,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
