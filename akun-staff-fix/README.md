# Akun Staff — Fix Pack

Replaces 3 files to fix:
1. **Build error**: `Module not found: Can't resolve '@/lib/admin'` → fixed import path to `@/lib/supabase/admin`
2. **Filter pill UX**: active state was easy to mistake for disabled → now uses amber tint, inactive pills have stronger borders

## How to use

1. Unzip
2. Drag the `app/` folder into `D:\aeac-kayon\` — Windows merges folders
3. When prompted "Replace files?" → **Replace the files in the destination**
4. Save / let dev server hot-reload — refresh `http://localhost:3000/akun-staff`

## Files replaced

```
app/api/akun-staff/create-user/route.ts        ← import path fix
app/api/akun-staff/send-magic-link/route.ts    ← import path fix
app/akun-staff/staff-onboarding-client.tsx     ← filter pill styling
```

No other files change. No env vars or DB changes needed.
