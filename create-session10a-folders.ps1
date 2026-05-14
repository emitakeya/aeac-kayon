# create-session10a-folders.ps1
# Creates the folder structure for Session 10A's three deliverable files.
# Does NOT write file contents — only creates folders and (optionally) empty
# placeholder files. You then paste Claude's code into them.
#
# Usage:
#   cd D:\aeac-kayon
#   .\create-session10a-folders.ps1
#
# Or with a custom root:
#   .\create-session10a-folders.ps1 -Root "D:\aeac-kayon"
#
# To also create empty placeholder files:
#   .\create-session10a-folders.ps1 -CreateStubs

param(
    [string]$Root = "D:\aeac-kayon",
    [switch]$CreateStubs
)

$ErrorActionPreference = "Stop"

# ── Sanity check ────────────────────────────────────────────────────
if (-not (Test-Path $Root)) {
    Write-Host "Project root not found: $Root" -ForegroundColor Red
    Write-Host "Pass a different path with -Root if needed." -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
Write-Host "Creating Session 10A folders in: $Root" -ForegroundColor White
Write-Host ("─" * 70) -ForegroundColor DarkGray

# ── Folders to ensure exist ─────────────────────────────────────────
$folders = @(
    "migrations"
    "app\api"
    "app\api\email"
    "app\api\email\send-report"
    "app\api\email\send-invoice-link"
)

foreach ($rel in $folders) {
    $full = Join-Path $Root $rel
    if (Test-Path $full) {
        Write-Host "  [EXISTS]  $rel" -ForegroundColor DarkGray
    } else {
        New-Item -ItemType Directory -Path $full -Force | Out-Null
        Write-Host "  [CREATED] $rel" -ForegroundColor Green
    }
}

# ── Optional: empty stub files ──────────────────────────────────────
if ($CreateStubs) {
    Write-Host ""
    Write-Host "Creating empty stub files..." -ForegroundColor White

    $stubs = @(
        "migrations\aeac_kayon_get_laporan_initial_data.sql"
        "app\api\email\send-report\route.ts"
        "app\api\email\send-invoice-link\route.ts"
    )

    foreach ($rel in $stubs) {
        $full = Join-Path $Root $rel
        if (Test-Path $full) {
            Write-Host "  [EXISTS]  $rel — not touching" -ForegroundColor Yellow
        } else {
            New-Item -ItemType File -Path $full -Force | Out-Null
            Write-Host "  [CREATED] $rel (empty)" -ForegroundColor Green
        }
    }
}

# ── Summary ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Open each of these three files (or create them by pasting):" -ForegroundColor DarkGray
Write-Host "       D:\aeac-kayon\migrations\aeac_kayon_get_laporan_initial_data.sql" -ForegroundColor DarkGray
Write-Host "       D:\aeac-kayon\app\api\email\send-report\route.ts" -ForegroundColor DarkGray
Write-Host "       D:\aeac-kayon\app\api\email\send-invoice-link\route.ts" -ForegroundColor DarkGray
Write-Host "  2. Paste the contents from Claude's output files." -ForegroundColor DarkGray
Write-Host "  3. Commit:" -ForegroundColor DarkGray
Write-Host "       git add migrations/ app/api/email/" -ForegroundColor DarkGray
Write-Host "       git commit -m 'Session 10A: /laporan-teknisi backend (RPC + email routes)'" -ForegroundColor DarkGray
Write-Host ""
