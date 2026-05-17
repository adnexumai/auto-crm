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

  return NextResponse.json(results);
}
