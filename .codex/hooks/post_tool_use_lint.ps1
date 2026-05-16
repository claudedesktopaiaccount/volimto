$ErrorActionPreference = "Continue"

$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) {
  exit 0
}

try {
  $payload = $inputJson | ConvertFrom-Json
  $command = [string]$payload.tool_input.command
  if ([string]::IsNullOrWhiteSpace($command)) {
    exit 0
  }

  $eslint = Join-Path (Get-Location) "node_modules\.bin\eslint.cmd"
  if (-not (Test-Path -LiteralPath $eslint)) {
    exit 0
  }

  $paths = [regex]::Matches($command, '(?m)^\*\*\* (?:Add|Update) File:\s+(.+?)\s*$') |
    ForEach-Object { $_.Groups[1].Value.Trim() } |
    Where-Object { $_ -match '\.(ts|tsx|js|jsx|mjs)$' } |
    Sort-Object -Unique

  foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
      & $eslint --fix -- $path *> $null
    }
  }
} catch {
  exit 0
}

exit 0
