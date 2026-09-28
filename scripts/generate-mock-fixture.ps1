$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$fixtureDirectory = Join-Path $repositoryRoot 'fixtures'
$fixturePath = Join-Path $fixtureDirectory 'mock-generation.mp4'
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw 'FFmpeg is not installed. Install it or provide fixtures/mock-generation.mp4.'
}
New-Item -ItemType Directory -Force -Path $fixtureDirectory | Out-Null
& ffmpeg -y -f lavfi -i 'color=c=0x0b100c:s=1280x720:d=5:r=24' -vf "drawtext=text='AEVRIX MOCK GENERATION':fontcolor=0x33CC00:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2" -c:v libx264 -pix_fmt yuv420p -movflags '+faststart' $fixturePath
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg could not create the mock fixture.' }
Write-Host "Created $fixturePath"
