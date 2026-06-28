/**
 * Spotted — database seed script
 * Run once: node scripts/seed.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
let env = {};
try {
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && !key.startsWith("#")) env[key.trim()] = rest.join("=").trim();
  }
} catch {
  // env vars may already be set in environment
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Make sure .env.local is filled in."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function upsertCelebrity(data) {
  const { data: row, error } = await supabase
    .from("celebrities")
    .upsert(data, { onConflict: "slug", ignoreDuplicates: false })
    .select("id, slug")
    .single();
  if (error) throw new Error(`Celebrity ${data.name}: ${error.message}`);
  return row;
}

async function insertPhoto(celebId, imageUrl) {
  const { data, error } = await supabase
    .from("photos")
    .insert({
      celebrity_id: celebId,
      fallback_image_url: imageUrl,
      ai_status: "complete",
      published: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Photo insert: ${error.message}`);
  return data.id;
}

async function insertItem(photoId, category, colour, desc, sort) {
  const { data, error } = await supabase
    .from("clothing_items")
    .insert({
      photo_id: photoId,
      category,
      colour,
      style_description: desc,
      sort_order: sort,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Item insert: ${error.message}`);
  return data.id;
}

async function insertMatches(itemId, matches) {
  const rows = matches.map((m, i) => ({ ...m, clothing_item_id: itemId, sort_order: i + 1 }));
  const { error } = await supabase.from("product_matches").insert(rows);
  if (error) throw new Error(`Match insert: ${error.message}`);
}

async function ensureAdmin(email) {
  const { data: user } = await supabase.auth.admin.getUserByEmail(email).catch(() => ({ data: null }));
  if (!user?.user) {
    console.log(`  ⚠  No auth user found for ${email}. Sign in first, then re-run.`);
    return;
  }
  await supabase
    .from("user_roles")
    .upsert({ user_id: user.user.id, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  console.log(`  ✓ Admin role set for ${email}`);
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const CELEBRITIES = [
  { name: "Dua Lipa",         bio: "Grammy-winning British-Albanian pop star and style icon known for her bold, eclectic fashion choices.", gender: "female" },
  { name: "Olivia Rodrigo",   bio: "Singer-songwriter who mixes Y2K nostalgia with punk-pop edge in her signature looks.", gender: "female" },
  { name: "Florence Pugh",    bio: "BAFTA-nominated actress celebrated for her fearless red-carpet style — from Valentino pink to vintage Dior.", gender: "female" },
  { name: "Molly-Mae Hague",  bio: "Influencer, entrepreneur and former Love Island star with a loyal following for her chic, accessible style.", gender: "female" },
  { name: "Millie Bobby Brown",bio: "Actress and entrepreneur who effortlessly transitions from casual street style to high-fashion glamour.", gender: "female" },
  { name: "Sienna Miller",    bio: "Actress and boho-chic pioneer whose 2000s festival style defined a generation — and is now back in full force.", gender: "female" },
  { name: "Alexa Chung",      bio: "British model, presenter and designer whose understated, art-school aesthetic has influenced fashion for over a decade.", gender: "female" },
  { name: "Stormzy",          bio: "Grime artist and cultural force — his streetwear-meets-tailoring look has made him one of the UK's most watched men in fashion.", gender: "male" },
  { name: "Harry Styles",     bio: "Former One Direction member turned solo artist with a gender-fluid, maximalist approach to dressing.", gender: "male" },
  { name: "Zendaya",          bio: "Actress and fashion icon who creates red-carpet moments that consistently shut down the internet.", gender: "female" },
  { name: "Kendall Jenner",   bio: "Model known for her model-off-duty minimalism — simple pieces styled to perfection.", gender: "female" },
  { name: "Hailey Bieber",    bio: "Model and entrepreneur whose clean-girl aesthetic set the tone for 2020s fashion.", gender: "female" },
];

// Sample looks with Unsplash placeholder images
const LOOKS = [
  {
    celebSlug: "dua-lipa",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80",
    items: [
      {
        category: "dress", colour: "black", desc: "Fitted bodycon mini dress with cut-out detailing",
        matches: [
          { product_name: "Karen Millen Cut Out Bodycon Mini Dress", retailer_name: "Karen Millen", product_url: "https://www.karenmillen.com", price_gbp: 149, price_tier: "premium", match_type: "similar" },
          { product_name: "River Island Black Cut Out Bodycon Dress", retailer_name: "River Island", product_url: "https://www.riverisland.com", price_gbp: 55, price_tier: "mid", match_type: "similar" },
          { product_name: "Boohoo Black Cut Out Mini Dress", retailer_name: "Boohoo", product_url: "https://www.boohoo.com", price_gbp: 22, price_tier: "budget", match_type: "similar" },
        ],
      },
      {
        category: "heels", colour: "black", desc: "Strappy stiletto heels",
        matches: [
          { product_name: "Jimmy Choo Romy 85 Sandal", retailer_name: "Jimmy Choo", product_url: "https://www.jimmychoo.com", price_gbp: 695, price_tier: "premium", match_type: "similar" },
          { product_name: "Office Strappy Stiletto Heels", retailer_name: "Office", product_url: "https://www.office.co.uk", price_gbp: 69.99, price_tier: "mid", match_type: "similar" },
          { product_name: "New Look Strappy Heeled Sandals", retailer_name: "New Look", product_url: "https://www.newlook.com", price_gbp: 27.99, price_tier: "budget", match_type: "similar" },
        ],
      },
    ],
  },
  {
    celebSlug: "harry-styles",
    image: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=600&q=80",
    items: [
      {
        category: "trousers", colour: "cream", desc: "Wide-leg tailored trousers with a high rise",
        matches: [
          { product_name: "Gucci Wide-Leg Wool Trousers", retailer_name: "Gucci", product_url: "https://www.gucci.com", price_gbp: 890, price_tier: "premium", match_type: "similar" },
          { product_name: "ASOS Wide Leg Tailored Trousers", retailer_name: "ASOS", product_url: "https://www.asos.com", price_gbp: 45, price_tier: "mid", match_type: "similar" },
          { product_name: "Primark Wide Leg Trousers", retailer_name: "Primark", product_url: "https://www.primark.com", price_gbp: 14, price_tier: "budget", match_type: "similar" },
        ],
      },
      {
        category: "vest", colour: "multicolour", desc: "Retro patterned knit vest top",
        matches: [
          { product_name: "JW Anderson Knit Intarsia Vest", retailer_name: "JW Anderson", product_url: "https://www.jwanderson.com", price_gbp: 490, price_tier: "premium", match_type: "similar" },
          { product_name: "ASOS Pattern Knit Vest", retailer_name: "ASOS", product_url: "https://www.asos.com", price_gbp: 32, price_tier: "mid", match_type: "similar" },
          { product_name: "H&M Patterned Knit Tank Top", retailer_name: "H&M", product_url: "https://www.hm.com", price_gbp: 12.99, price_tier: "budget", match_type: "similar" },
        ],
      },
    ],
  },
  {
    celebSlug: "florence-pugh",
    image: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&q=80",
    items: [
      {
        category: "blazer", colour: "camel", desc: "Oversized camel blazer worn open over a simple white top",
        matches: [
          { product_name: "Toteme Tailored Wool Blazer", retailer_name: "Toteme", product_url: "https://www.toteme-studio.com", price_gbp: 620, price_tier: "premium", match_type: "similar" },
          { product_name: "Marks & Spencer Camel Blazer", retailer_name: "M&S", product_url: "https://www.marksandspencer.com", price_gbp: 89, price_tier: "mid", match_type: "similar" },
          { product_name: "George at Asda Camel Blazer", retailer_name: "Asda George", product_url: "https://direct.asda.com/george", price_gbp: 28, price_tier: "budget", match_type: "similar" },
        ],
      },
      {
        category: "jeans", colour: "blue", desc: "Straight-leg mid-wash jeans",
        matches: [
          { product_name: "AG Jeans The Jodi High-Rise Straight", retailer_name: "AG Jeans", product_url: "https://www.agjeansofficial.com", price_gbp: 260, price_tier: "premium", match_type: "similar" },
          { product_name: "Levi's 501 Mid-Wash Jeans", retailer_name: "Levi's", product_url: "https://www.levi.com/GB", price_gbp: 90, price_tier: "mid", match_type: "similar" },
          { product_name: "Next Straight Leg Jeans", retailer_name: "Next", product_url: "https://www.next.co.uk", price_gbp: 35, price_tier: "budget", match_type: "similar" },
        ],
      },
    ],
  },
  {
    celebSlug: "molly-mae-hague",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80",
    items: [
      {
        category: "co-ord set", colour: "beige", desc: "Matching beige ribbed lounge set — crop top and wide-leg joggers",
        matches: [
          { product_name: "Skims Soft Lounge Long Slip Set", retailer_name: "Skims", product_url: "https://www.skims.com", price_gbp: 148, price_tier: "premium", match_type: "similar" },
          { product_name: "PrettyLittleThing Ribbed Co-ord Set", retailer_name: "PrettyLittleThing", product_url: "https://www.prettylittlething.com", price_gbp: 34, price_tier: "mid", match_type: "similar" },
          { product_name: "In The Style Ribbed Lounge Set", retailer_name: "In The Style", product_url: "https://www.inthestyle.com", price_gbp: 22.99, price_tier: "budget", match_type: "similar" },
        ],
      },
    ],
  },
  {
    celebSlug: "zendaya",
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80",
    items: [
      {
        category: "gown", colour: "emerald green", desc: "Strapless structured column gown with a dramatic silhouette",
        matches: [
          { product_name: "Roland Mouret Column Gown", retailer_name: "Roland Mouret", product_url: "https://www.rolandmouret.com", price_gbp: 2400, price_tier: "premium", match_type: "similar" },
          { product_name: "ASOS Edition Satin Column Maxi Dress", retailer_name: "ASOS Edition", product_url: "https://www.asos.com", price_gbp: 120, price_tier: "mid", match_type: "similar" },
          { product_name: "Chi Chi London Maxi Dress", retailer_name: "Chi Chi London", product_url: "https://www.chichiclothing.com", price_gbp: 55, price_tier: "budget", match_type: "similar" },
        ],
      },
      {
        category: "earrings", colour: "gold", desc: "Sculptural drop earrings",
        matches: [
          { product_name: "Completedworks Sculptural Drop Earrings", retailer_name: "Completedworks", product_url: "https://www.completedworks.com", price_gbp: 280, price_tier: "premium", match_type: "similar" },
          { product_name: "Mango Sculptural Drop Earrings", retailer_name: "Mango", product_url: "https://www.mango.com/gb", price_gbp: 19.99, price_tier: "mid", match_type: "similar" },
          { product_name: "ASOS Drop Earrings", retailer_name: "ASOS", product_url: "https://www.asos.com", price_gbp: 9.99, price_tier: "budget", match_type: "similar" },
        ],
      },
    ],
  },
  {
    celebSlug: "millie-bobby-brown",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80",
    items: [
      {
        category: "jacket", colour: "white", desc: "Oversized white leather jacket paired with a simple black look",
        matches: [
          { product_name: "Acne Studios Leather Jacket", retailer_name: "Acne Studios", product_url: "https://www.acnestudios.com", price_gbp: 1200, price_tier: "premium", match_type: "similar" },
          { product_name: "ASOS Faux Leather Oversized Jacket", retailer_name: "ASOS", product_url: "https://www.asos.com", price_gbp: 65, price_tier: "mid", match_type: "similar" },
          { product_name: "New Look Faux Leather Jacket", retailer_name: "New Look", product_url: "https://www.newlook.com", price_gbp: 34.99, price_tier: "budget", match_type: "similar" },
        ],
      },
    ],
  },
  {
    celebSlug: "kendall-jenner",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
    items: [
      {
        category: "top", colour: "white", desc: "Simple fitted white tank top tucked into high-waist trousers",
        matches: [
          { product_name: "The Row Pima Cotton Tank", retailer_name: "The Row", product_url: "https://www.therow.com", price_gbp: 290, price_tier: "premium", match_type: "similar" },
          { product_name: "Arket Fitted Cotton Tank", retailer_name: "Arket", product_url: "https://www.arket.com", price_gbp: 27, price_tier: "mid", match_type: "similar" },
          { product_name: "H&M Fitted Tank Top", retailer_name: "H&M", product_url: "https://www.hm.com", price_gbp: 7.99, price_tier: "budget", match_type: "similar" },
        ],
      },
      {
        category: "trousers", colour: "black", desc: "High-waisted wide-leg trousers in fluid fabric",
        matches: [
          { product_name: "The Frankie Shop Gelso Trousers", retailer_name: "The Frankie Shop", product_url: "https://thefrankieshop.com", price_gbp: 220, price_tier: "premium", match_type: "similar" },
          { product_name: "& Other Stories Wide Leg Trousers", retailer_name: "& Other Stories", product_url: "https://www.stories.com", price_gbp: 77, price_tier: "mid", match_type: "similar" },
          { product_name: "ASOS Wide Leg Trousers", retailer_name: "ASOS", product_url: "https://www.asos.com", price_gbp: 28, price_tier: "budget", match_type: "similar" },
        ],
      },
    ],
  },
];

// ── Run ───────────────────────────────────────────────────────────────────────

async function run() {
  console.log("🌱 Seeding Spotted database...\n");

  // 1. Celebrities
  console.log("1. Adding celebrities...");
  const celebMap = {};
  for (const celeb of CELEBRITIES) {
    const s = slug(celeb.name);
    const row = await upsertCelebrity({ name: celeb.name, slug: s, bio: celeb.bio, gender: celeb.gender });
    celebMap[s] = row.id;
    console.log(`   ✓ ${celeb.name}`);
  }

  // 2. Photos + clothing items + product matches
  console.log("\n2. Adding looks, clothing items and product matches...");
  for (const look of LOOKS) {
    const celebId = celebMap[look.celebSlug];
    if (!celebId) { console.log(`   ⚠  Skipping — no celebrity found for slug ${look.celebSlug}`); continue; }

    const photoId = await insertPhoto(celebId, look.image);

    for (let i = 0; i < look.items.length; i++) {
      const { category, colour, desc, matches } = look.items[i];
      const itemId = await insertItem(photoId, category, colour, desc, i + 1);
      await insertMatches(itemId, matches);
    }
    console.log(`   ✓ ${look.celebSlug} — ${look.items.length} item(s), ${look.items.reduce((s, i) => s + i.matches.length, 0)} matches`);
  }

  // 3. Admin user
  console.log("\n3. Setting up admin user...");
  await ensureAdmin("mike@bdwoods.co.uk");

  console.log("\n✅ Done! Visit your site to see the content.\n");
}

run().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
