Add-Type -AssemblyName System.Drawing

$inputPath = "C:\Users\19tlj\Downloads\ChatGPT Image May 10, 2026, 09_45_20 PM.png"
$outputPath = Join-Path (Resolve-Path ".").Path "assets\pilot-tractor-trailer-marker.png"

if (!(Test-Path $inputPath)) {
  throw "Input image not found: $inputPath"
}

$source = [System.Drawing.Bitmap]::FromFile($inputPath)

function Is-TruckRed([System.Drawing.Color]$c) {
  return (
    $c.R -gt 115 -and
    $c.R -gt ($c.G * 1.55) -and
    $c.R -gt ($c.B * 1.35) -and
    ($c.R - $c.G) -gt 45
  )
}

$minX = $source.Width
$minY = $source.Height
$maxX = 0
$maxY = 0

for ($y = 0; $y -lt $source.Height; $y += 2) {
  for ($x = 0; $x -lt $source.Width; $x += 2) {
    $pixel = $source.GetPixel($x, $y)
    if (Is-TruckRed $pixel) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

if ($maxX -le $minX -or $maxY -le $minY) {
  throw "Could not detect truck red body in source image."
}

$padX = 36
$padY = 34
$cropX = [Math]::Max(0, $minX - $padX)
$cropY = [Math]::Max(0, $minY - $padY)
$cropW = [Math]::Min($source.Width - $cropX, ($maxX - $minX) + ($padX * 2))
$cropH = [Math]::Min($source.Height - $cropY, ($maxY - $minY) + ($padY * 2))

$crop = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $cropW, $cropH), [System.Drawing.Rectangle]::new($cropX, $cropY, $cropW, $cropH), [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$source.Dispose()

$mask = New-Object 'bool[,]' $cropW, $cropH

for ($y = 0; $y -lt $cropH; $y++) {
  for ($x = 0; $x -lt $cropW; $x++) {
    $pixel = $crop.GetPixel($x, $y)
    $isRed = Is-TruckRed $pixel

    # Keep bright chrome/white areas only when they are inside the likely truck band.
    $inCabBand = $x -lt ($cropW * 0.22)
    $isCabChrome = $inCabBand -and $pixel.R -gt 130 -and $pixel.G -gt 120 -and $pixel.B -gt 115

    $mask[$x, $y] = $isRed -or $isCabChrome
  }
}

# Dilate the red/chrome mask enough to include wheels, lights, black trim, and the fifth-wheel gap.
for ($iteration = 0; $iteration -lt 18; $iteration++) {
  $next = New-Object 'bool[,]' $cropW, $cropH
  for ($y = 0; $y -lt $cropH; $y++) {
    for ($x = 0; $x -lt $cropW; $x++) {
      if ($mask[$x, $y]) {
        for ($dy = -1; $dy -le 1; $dy++) {
          for ($dx = -1; $dx -le 1; $dx++) {
            $nx = $x + $dx
            $ny = $y + $dy
            if ($nx -ge 0 -and $nx -lt $cropW -and $ny -ge 0 -and $ny -lt $cropH) {
              $next[$nx, $ny] = $true
            }
          }
        }
      }
    }
  }
  $mask = $next
}

# Trim snow/road accidentally caught outside the truck silhouette by requiring proximity to red pixels horizontally.
$redColumns = New-Object 'bool[]' $cropW
for ($x = 0; $x -lt $cropW; $x++) {
  for ($y = 0; $y -lt $cropH; $y++) {
    if (Is-TruckRed $crop.GetPixel($x, $y)) {
      $redColumns[$x] = $true
      break
    }
  }
}

for ($y = 0; $y -lt $cropH; $y++) {
  for ($x = 0; $x -lt $cropW; $x++) {
    if (!$mask[$x, $y]) { continue }
    $nearRedColumn = $false
    for ($dx = -24; $dx -le 24; $dx++) {
      $nx = $x + $dx
      if ($nx -ge 0 -and $nx -lt $cropW -and $redColumns[$nx]) {
        $nearRedColumn = $true
        break
      }
    }
    if (!$nearRedColumn) {
      $mask[$x, $y] = $false
    }
  }
}

$transparent = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $cropH; $y++) {
  for ($x = 0; $x -lt $cropW; $x++) {
    $pixel = $crop.GetPixel($x, $y)
    if ($mask[$x, $y]) {
      $transparent.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $pixel.R, $pixel.G, $pixel.B))
    } else {
      $transparent.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    }
  }
}
$crop.Dispose()

# Rotate so the tractor cab faces upward on the map marker.
$transparent.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)

# Add padding so the marker has breathing room and antialias when scaled in React Native.
$pad = 24
$final = New-Object System.Drawing.Bitmap(($transparent.Width + $pad * 2), ($transparent.Height + $pad * 2), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$fg = [System.Drawing.Graphics]::FromImage($final)
$fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fg.Clear([System.Drawing.Color]::Transparent)
$fg.DrawImage($transparent, $pad, $pad, $transparent.Width, $transparent.Height)
$fg.Dispose()
$transparent.Dispose()

$final.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$final.Dispose()

Write-Host "Generated $outputPath"
