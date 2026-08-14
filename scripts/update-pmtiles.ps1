param(
  [Parameter(Mandatory = $true)]
  [string]$SourceUrl,
  [string]$PmtilesExecutable = "pmtiles"
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$regionFile = Join-Path $PSScriptRoot "pmtiles-regions.geojson"
$outputDir = Join-Path $repoRoot "public\maps"
$outputFile = Join-Path $outputDir "travel-miyazaki.pmtiles"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
& $PmtilesExecutable extract $SourceUrl $outputFile --region $regionFile --maxzoom 14
if ($LASTEXITCODE -ne 0) {
  throw "PMTilesの抽出に失敗しました (exit code: $LASTEXITCODE)"
}

Get-Item $outputFile | Select-Object FullName, Length, LastWriteTime
