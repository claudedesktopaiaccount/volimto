$ErrorActionPreference = "Stop"

$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) {
  exit 0
}

$payload = $inputJson | ConvertFrom-Json
$command = [string]$payload.tool_input.command
if ([string]::IsNullOrWhiteSpace($command)) {
  exit 0
}

$blockedPattern = '(^|[\\/])(\.env($|\.)|package-lock\.json$)'
$touchedPaths = [regex]::Matches($command, '(?m)^\*\*\* (?:Add|Update|Delete) File:\s+(.+?)\s*$') |
  ForEach-Object { $_.Groups[1].Value.Trim() }

foreach ($path in $touchedPaths) {
  $normalized = $path -replace '\\', '/'
  if ($normalized -match $blockedPattern) {
    $reason = "BLOCK: Do not edit .env or package-lock.json directly. Use npm install for dependencies, and edit .env files manually."
    [Console]::Error.WriteLine($reason)
    exit 2
  }
}

exit 0
