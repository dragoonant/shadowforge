# Labelled contact sheets for QC (adapted from FleshAndBloodTCG/tools/contact-sheet.ps1).
# Reads PNG/JPG masters (System.Drawing cannot read WebP) and writes
# scratch/assets-sheets/sheet-<Name>-<n>.jpg, 16 tiles per sheet (8 x 2), each tile labelled with its id.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/contact-sheet.ps1 [-Name cards] [-Dir art\masters] [-Keys "id1,id2"] [-Wide]
#     [-Columns N -TileW px -OutFile path\file.jpg -NoNumber]   (one sheet with N columns, e.g. an audition grid)
param([string]$Name = 'cards', [string]$Dir = 'art\masters', [string]$Keys = '', [switch]$Wide, [int]$Columns = 0, [int]$TileW = 0, [int]$TileH = 0, [int]$PerSheet = 0, [string]$OutFile = '', [switch]$NoNumber)
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = $(if ([System.IO.Path]::IsPathRooted($Dir)) { $Dir } else { Join-Path $root $Dir })
$out = Join-Path $root 'scratch\assets-sheets'
New-Item -ItemType Directory -Force $out | Out-Null
$list = @()
if ($Keys -ne '') { foreach ($k in $Keys.Split(',')) { foreach ($ext in '.png', '.jpg') { $p = Join-Path $src ($k.Trim() + $ext); if (Test-Path $p) { $list += Get-Item $p; break } } } }
else { $list = Get-ChildItem $src -File | Where-Object { $_.Extension -in '.png', '.jpg' } | Sort-Object Name }
if ($Wide) { $cols = 4; $tw = 400; $th = 225; $page = 8 } else { $cols = 8; $tw = 180; $th = 270; $page = 16 }
if ($Columns -gt 0) { $cols = $Columns; $page = $(if ($PerSheet -gt 0) { $PerSheet } else { 9999 }) }
if ($TileW -gt 0) { $th = [int]($th * $TileW / $tw); $tw = $TileW }
if ($TileH -gt 0) { $th = $TileH }
$lab = 30
for ($p = 0; $p * $page -lt $list.Count; $p++) {
  $set = $list | Select-Object -Skip ($p * $page) -First $page
  $rows = [math]::Ceiling($set.Count / $cols)
  $bmp = New-Object System.Drawing.Bitmap ($cols * $tw), ($rows * ($th + $lab))
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::Black)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $font = New-Object System.Drawing.Font 'Segoe UI', $(if ($TileW -ge 250) { 11 } else { 7 })
  $i = 0
  foreach ($f in $set) {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $x = ($i % $cols) * $tw; $y = [math]::Floor($i / $cols) * ($th + $lab)
    $g.DrawImage($img, $x, $y, $tw, $th)
    $g.DrawString($(if ($NoNumber) { $f.BaseName } else { '' + ($p * $page + $i + 1) + ' ' + $f.BaseName }), $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF ($x + 2), ($y + $th + 1), ($tw - 4), ($lab - 2)))
    $img.Dispose(); $i++
  }
  $g.Dispose()
  $dest = $(if ($OutFile -ne '') { Join-Path $root $OutFile } else { Join-Path $out "sheet-$Name-$p.jpg" }); $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Jpeg); $bmp.Dispose()
}
Write-Output "$($list.Count) image(s) on $([math]::Ceiling($list.Count / $page)) sheet(s): scratch/assets-sheets/sheet-$Name-*.jpg"
