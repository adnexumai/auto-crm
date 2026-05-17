// Debug endpoint to verify CRM lookup logic
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone") || "5492975283819";

  const supabase = getSupabase();
  const results: Record<string, unknown> = { phone };

  // Test 1: simple .eq() exact match
  {
    const { data, error } = await supabase
      .from("prospectos")
      .select("telefono, oportunidad_score")
      .eq("telefono", phone)
      .limit(3);
    results.eq_no_plus = { data, error: error?.message };
  }

  // Test 2: .eq() with +
  {
    const { data, error } = await supabase
      .from("prospectos")
      .select("telefono, oportunidad_score")
      .eq("telefono", `+${phone}`)
      .limit(3);
    results.eq_with_plus = { data, error: error?.message };
  }

  // Test 3: .ilike() partial match
  {
    const { data, error } = await supabase
      .from("prospectos")
      .select("telefono, oportunidad_score")
      .ilike("telefono", `%${phone}%`)
      .limit(3);
    results.ilike = { data, error: error?.message };
  }

  // Test 4: .or() with single ilike
  {
    const { data, error } = await supabase
      .from("prospectos")
      .select("telefono, oportunidad_score")
      .or(`telefono.ilike.%${phone}%`)
      .limit(3);
    results.or_single_ilike = { data, error: error?.message };
  }

  // Test 5: .in() variants
  {
    const { data, error } = await supabase
      .from("prospectos")
      .select("telefono, oportunidad_score")
      .in("telefono", [phone, `+${phone}`])
      .limit(3);
    results.in_variants = { data, error: error?.message };
  }

  // Test 6: real-world case — multiple phones via .in()
  {
    const realPhones = [
      "5492975283819", "5492974194948", "5492975001804",
      "5491144267202", "542974265783", "5492945532421",
    ];
    const variants = realPhones.flatMap((p) => [p, `+${p}`]);
    const { data, error } = await supabase
      .from("prospectos")
      .select("telefono, oportunidad_score")
      .in("telefono", variants);
    results.in_multi = {
      variantsCount: variants.length,
      matched: data?.length ?? 0,
      data,
      error: error?.message,
    };
  }

  // Test 7: real-world case — multiple via .or() ilike
  {
    const realPhones = [
      "5492975283819", "5492974194948", "5492975001804",
      "5491144267202", "542974265783", "5492945532421",
    ];
    const orFilter = realPhones.map((p) => `telefono.ilike.%${p}%`).join(",");
    const { data, error } = await supabase
      .from("prospectos")
      .select("telefono, oportunidad_score")
      .or(orFilter);
    results.or_multi = {
      filter: orFilter,
      matched: data?.length ?? 0,
      data,
      error: error?.message,
    };
  }

  // Test 8: simulate the EXACT same code path as /api/chatwoot/conversations
  // Fetch live Chatwoot list, then run the same lookup
  {
    try {
      const cwUrl = `${process.env.CHATWOOT_BASE_URL}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}/conversations?status=open&assignee_type=me&page=1`;
      const cwRes = await fetch(cwUrl, {
        headers: { api_access_token: process.env.CHATWOOT_API_TOKEN || "" },
      });
      const cwBody = await cwRes.json();
      const payload = cwBody?.data?.payload || [];
      const livePhones = Array.from(
        new Set(
          payload
            .map((c: { meta?: { sender?: { phone_number?: string } } }) =>
              (c.meta?.sender?.phone_number || "").replace(/[^\d]/g, "")
            )
            .filter((p: string) => p.length > 0)
        )
      );
      const variants = (livePhones as string[]).flatMap((p) => [p, `+${p}`]);
      const { data: r1 } = await supabase
        .from("prospectos")
        .select("telefono, oportunidad_score")
        .in("telefono", variants);
      results.live_simulation = {
        chatwootPhonesCount: livePhones.length,
        variantsCount: variants.length,
        livePhonesSample: (livePhones as string[]).slice(0, 5),
        variantsSample: variants.slice(0, 6),
        matched: r1?.length ?? 0,
        matchedData: r1,
      };
    } catch (e) {
      results.live_simulation = { error: String(e) };
    }
  }

  return NextResponse.json(results);
}
