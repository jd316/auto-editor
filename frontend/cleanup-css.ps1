# PowerShell script to clean up redundant CSS files
# This script removes CSS files that have been consolidated into main.css

Write-Host "Cleaning up redundant CSS files..."

# Files to be removed - these are now in main.css
$redundantFiles = @(
    "app/additional-styles.css",
    "app/fixed-styles.css",
    "app/navbar-fix.css", 
    "app/mobile-navbar-fix.css",
    "app/how-it-works.css",
    "app/header-btn-fix.css",
    "app/mobile-fixes.css",
    "fix-header-btn.css",
    "fix.css"
)

foreach ($file in $redundantFiles) {
    $path = Join-Path -Path $PSScriptRoot -ChildPath $file
    if (Test-Path $path) {
        Write-Host "Removing: $file"
        Remove-Item -Path $path -Force
    } else {
        Write-Host "File not found: $file"
    }
}

Write-Host "CSS cleanup complete!"
Write-Host "The CSS has been consolidated into styles/main.css" 