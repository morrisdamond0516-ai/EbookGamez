import "./load-env.ts";

const PRODUCTION_BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error("no ADMIN_PASSWORD");

const login = await fetch(`${PRODUCTION_BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
const { token } = await login.json();

for (const q of ["", "?status=published", "?status=active"]) {
  const res = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts${q}`, {
    headers: { "x-admin-token": token },
  });
  const data = await res.json();
  console.log(`\n=== drafts${q || "(all)"} count=${Array.isArray(data) ? data.length : "not array"} ===`);
  if (Array.isArray(data) && data[0]) {
    console.log("sample keys:", Object.keys(data[0]).join(", "));
    const withIll = data.filter((d: any) => (d.completedIllustrations || d.completed_illustrations || 0) > 0 || (d.hasIllustrations || d.has_illustrations));
    console.log("with illustration flags:", withIll.length);
    const withMarkers = data.filter((d: any) => (d.totalIllustrationMarkers || d.total_illustration_markers || 0) > 0);
    console.log("with marker count:", withMarkers.length);
    if (data[476 - 1] || data.find((d: any) => d.id === 476)) {
      const d476 = data.find((d: any) => d.id === 476);
      console.log("#476:", JSON.stringify(d476, null, 0).slice(0, 300));
    }
  }
}
