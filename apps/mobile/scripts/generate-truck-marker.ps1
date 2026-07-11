Add-Type -AssemblyName System.Drawing

$outPath = Join-Path (Resolve-Path ".").Path "assets\truck-marker-3d.png"
$width = 144
$height = 228
$bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-RoundRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundRect($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-RoundRectPath $x $y $w $h $r
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Stroke-RoundRect($g, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-RoundRectPath $x $y $w $h $r
  $g.DrawPath($pen, $path)
  $path.Dispose()
}

# Soft ground shadow for the full tractor-trailer.
$shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$shadowPath.AddEllipse(34, 18, 76, 190)
$shadowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($shadowPath)
$shadowBrush.CenterColor = [System.Drawing.Color]::FromArgb(86, 0, 0, 0)
$shadowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$graphics.FillPath($shadowBrush, $shadowPath)
$shadowBrush.Dispose()
$shadowPath.Dispose()

# Wheels tucked outside the trailer and tractor body.
$wheelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 24, 25, 28))
$wheelEdge = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(210, 5, 6, 8), 1.5)
foreach ($rect in @(
  [System.Drawing.RectangleF]::new(38, 44, 15, 34),
  [System.Drawing.RectangleF]::new(91, 44, 15, 34),
  [System.Drawing.RectangleF]::new(38, 90, 15, 34),
  [System.Drawing.RectangleF]::new(91, 90, 15, 34),
  [System.Drawing.RectangleF]::new(39, 133, 14, 30),
  [System.Drawing.RectangleF]::new(91, 133, 14, 30),
  [System.Drawing.RectangleF]::new(42, 180, 14, 28),
  [System.Drawing.RectangleF]::new(88, 180, 14, 28)
)) {
  Fill-RoundRect $graphics $wheelBrush $rect.X $rect.Y $rect.Width $rect.Height 7
  Stroke-RoundRect $graphics $wheelEdge $rect.X $rect.Y $rect.Width $rect.Height 7
}

# Long pilot trailer, top-down.
$trailerRect = [System.Drawing.RectangleF]::new(50, 18, 44, 140)
$trailerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $trailerRect,
  [System.Drawing.Color]::FromArgb(255, 244, 42, 48),
  [System.Drawing.Color]::FromArgb(255, 157, 10, 17),
  [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
)
Fill-RoundRect $graphics $trailerBrush 50 18 44 140 9
$trailerBrush.Dispose()

$trailerBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(238, 115, 5, 12), 2)
Stroke-RoundRect $graphics $trailerBorder 50 18 44 140 9

$leftShade = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 89, 0, 0))
Fill-RoundRect $graphics $leftShade 51 24 9 128 5

$roofHighlight = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  [System.Drawing.RectangleF]::new(70, 30, 15, 112),
  [System.Drawing.Color]::FromArgb(130, 255, 255, 255),
  [System.Drawing.Color]::FromArgb(6, 255, 255, 255),
  [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
Fill-RoundRect $graphics $roofHighlight 69 30 16 112 8
$roofHighlight.Dispose()

$doorPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), 2)
$graphics.DrawLine($doorPen, 57, 23, 87, 23)
$graphics.DrawLine($doorPen, 57, 151, 87, 151)
$graphics.DrawLine($doorPen, 72, 25, 72, 35)

# Trailer branding, vertical because the vehicle is top-down.
$font = New-Object System.Drawing.Font("Arial", 8.5, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 255, 255, 255))
$state = $graphics.Save()
$graphics.TranslateTransform(72, 88)
$graphics.RotateTransform(-90)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString("TSR", $font, $textBrush, [System.Drawing.RectangleF]::new(-58, -8, 116, 16), $format)
$graphics.Restore($state)

# Fifth-wheel / tractor frame gap.
$frameBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 72, 74, 78))
Fill-RoundRect $graphics $frameBrush 58 158 28 18 5
$plateBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 33, 35, 38))
$graphics.FillEllipse($plateBrush, 61, 158, 22, 14)

# Tractor cab, distinct from trailer.
$cabRect = [System.Drawing.RectangleF]::new(48, 170, 48, 45)
$cabBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $cabRect,
  [System.Drawing.Color]::FromArgb(255, 252, 252, 252),
  [System.Drawing.Color]::FromArgb(255, 198, 202, 206),
  [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
Fill-RoundRect $graphics $cabBrush 48 170 48 45 16
$cabBrush.Dispose()

$cabBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, 132, 138, 144), 2)
Stroke-RoundRect $graphics $cabBorder 48 170 48 45 16

# Cab side color accents to tie it to the trailer.
$cabAccentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 212, 24, 31))
Fill-RoundRect $graphics $cabAccentBrush 51 178 7 25 4
Fill-RoundRect $graphics $cabAccentBrush 86 178 7 25 4

# Windshield and hood.
$windshieldBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  [System.Drawing.RectangleF]::new(56, 174, 32, 16),
  [System.Drawing.Color]::FromArgb(255, 16, 126, 154),
  [System.Drawing.Color]::FromArgb(255, 107, 220, 234),
  [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
)
Fill-RoundRect $graphics $windshieldBrush 56 174 32 16 5
$windshieldBrush.Dispose()

$glassPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 255, 255, 255), 1.5)
$graphics.DrawLine($glassPen, 62, 176, 84, 188)

$hoodBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 236, 237, 239))
Fill-RoundRect $graphics $hoodBrush 55 192 34 13 7

$grilleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 78, 82, 86))
Fill-RoundRect $graphics $grilleBrush 60 206 24 4 2

$headlightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 248, 198))
$graphics.FillEllipse($headlightBrush, 54, 202, 7, 5)
$graphics.FillEllipse($headlightBrush, 83, 202, 7, 5)

# Tail marker lights.
$tailBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 110, 0, 0))
$graphics.FillEllipse($tailBrush, 55, 25, 5, 5)
$graphics.FillEllipse($tailBrush, 84, 25, 5, 5)

$bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$wheelBrush.Dispose()
$wheelEdge.Dispose()
$trailerBorder.Dispose()
$leftShade.Dispose()
$doorPen.Dispose()
$font.Dispose()
$textBrush.Dispose()
$format.Dispose()
$frameBrush.Dispose()
$plateBrush.Dispose()
$cabBorder.Dispose()
$cabAccentBrush.Dispose()
$glassPen.Dispose()
$hoodBrush.Dispose()
$grilleBrush.Dispose()
$headlightBrush.Dispose()
$tailBrush.Dispose()

Write-Host "Generated $outPath"
