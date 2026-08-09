[CmdletBinding()]
param(
    [ValidateSet('Mount', 'Status', 'Unmount')]
    [string]$Action = 'Mount',
    [string]$VueHostRoot,
    [string]$NodeHostRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ModuleId = 'phoenix-open-issue'
$RepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$WorkspaceRoot = Split-Path -Parent $RepositoryRoot
$MarkerStart = "# >>> $ModuleId admin-plugin dev mount >>>"
$MarkerEnd = "# <<< $ModuleId admin-plugin dev mount <<<"

function Get-UnresolvedFullPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
}

if ([string]::IsNullOrWhiteSpace($VueHostRoot)) {
    $VueHostRoot = if ($env:PHOENIX_ADMIN_VUE_ROOT) {
        $env:PHOENIX_ADMIN_VUE_ROOT
    } else {
        Join-Path $WorkspaceRoot 'phoenix-admin-vue'
    }
}
if ([string]::IsNullOrWhiteSpace($NodeHostRoot)) {
    $NodeHostRoot = if ($env:PHOENIX_ADMIN_NODE_ROOT) {
        $env:PHOENIX_ADMIN_NODE_ROOT
    } else {
        Join-Path $WorkspaceRoot 'phoenix-admin-node'
    }
}

$Mounts = @(
    [pscustomobject]@{
        Label = 'Vue Host'
        HostRoot = Get-UnresolvedFullPath $VueHostRoot
        Source = Join-Path $RepositoryRoot 'packages\admin-plugin\vue\phoenix-open-issue'
    },
    [pscustomobject]@{
        Label = 'Node Host'
        HostRoot = Get-UnresolvedFullPath $NodeHostRoot
        Source = Join-Path $RepositoryRoot 'packages\admin-plugin\midway\phoenix-open-issue'
    }
) | ForEach-Object {
    $_ | Add-Member -NotePropertyName Target -NotePropertyValue (
        Join-Path $_.HostRoot "src\modules\$ModuleId"
    ) -PassThru
}

function Get-NormalizedPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Test-SamePath {
    param(
        [Parameter(Mandatory = $true)][string]$Left,
        [Parameter(Mandatory = $true)][string]$Right
    )

    return [string]::Equals(
        (Get-NormalizedPath $Left),
        (Get-NormalizedPath $Right),
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Get-MountState {
    param([Parameter(Mandatory = $true)]$Mount)

    $Item = Get-Item -LiteralPath $Mount.Target -Force -ErrorAction SilentlyContinue
    if ($null -eq $Item) {
        return [pscustomobject]@{ State = 'Missing'; LinkType = $null; ActualTarget = $null }
    }

    $LinkTypeProperty = $Item.PSObject.Properties['LinkType']
    $LinkType = if ($null -eq $LinkTypeProperty) { $null } else { [string]$LinkTypeProperty.Value }
    if ($LinkType -ne 'Junction') {
        return [pscustomobject]@{ State = 'Occupied'; LinkType = $LinkType; ActualTarget = $null }
    }

    $TargetProperty = $Item.PSObject.Properties['Target']
    $RawTarget = if ($null -eq $TargetProperty) { $null } else { [string](@($TargetProperty.Value)[0]) }
    if ([string]::IsNullOrWhiteSpace($RawTarget)) {
        return [pscustomobject]@{ State = 'ForeignJunction'; LinkType = $LinkType; ActualTarget = $null }
    }
    if (-not [System.IO.Path]::IsPathRooted($RawTarget)) {
        $RawTarget = Join-Path (Split-Path -Parent $Mount.Target) $RawTarget
    }
    $ActualTarget = Get-NormalizedPath $RawTarget
    $State = if (Test-SamePath $ActualTarget $Mount.Source) { 'Mounted' } else { 'ForeignJunction' }
    return [pscustomobject]@{ State = $State; LinkType = $LinkType; ActualTarget = $ActualTarget }
}

function Get-GitExcludePath {
    param([Parameter(Mandatory = $true)]$Mount)

    $Output = & git -C $Mount.HostRoot rev-parse --git-path info/exclude 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$($Mount.Label) 不是可用的 Git 工作区：$($Mount.HostRoot)；$Output"
    }
    $Path = [string]($Output | Select-Object -Last 1)
    if (-not [System.IO.Path]::IsPathRooted($Path)) {
        $Path = Join-Path $Mount.HostRoot $Path
    }
    return Get-UnresolvedFullPath $Path
}

function Remove-ManagedExcludeBlock {
    param([string]$Content)

    $Next = [System.Collections.Generic.List[string]]::new()
    $Managed = $false
    foreach ($Line in ($Content -split "`r?`n")) {
        if ($Line -eq $MarkerStart) {
            $Managed = $true
            continue
        }
        if ($Line -eq $MarkerEnd) {
            $Managed = $false
            continue
        }
        if (-not $Managed) {
            $Next.Add($Line)
        }
    }
    return (($Next -join [Environment]::NewLine).TrimEnd())
}

function Update-LocalExclude {
    param(
        [Parameter(Mandatory = $true)]$Mount,
        [Parameter(Mandatory = $true)][bool]$Enabled
    )

    $ExcludePath = Get-GitExcludePath $Mount
    $Content = if (Test-Path -LiteralPath $ExcludePath) {
        [System.IO.File]::ReadAllText($ExcludePath)
    } else {
        ''
    }
    $Base = Remove-ManagedExcludeBlock $Content
    $Pattern = '/src/modules/phoenix-open-issue'
    $Block = "$MarkerStart$([Environment]::NewLine)$Pattern$([Environment]::NewLine)$MarkerEnd"
    $Next = if ($Enabled) {
        "$Base$(if ($Base) { [Environment]::NewLine + [Environment]::NewLine })$Block$([Environment]::NewLine)"
    } else {
        "$Base$(if ($Base) { [Environment]::NewLine })"
    }

    $Parent = Split-Path -Parent $ExcludePath
    if (-not (Test-Path -LiteralPath $Parent -PathType Container)) {
        New-Item -ItemType Directory -Path $Parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($ExcludePath, $Next, [System.Text.UTF8Encoding]::new($false))
    return $Pattern
}

function Test-LocalExclude {
    param([Parameter(Mandatory = $true)]$Mount)

    & git -C $Mount.HostRoot check-ignore -q -- 'src/modules/phoenix-open-issue'
    return $LASTEXITCODE -eq 0
}

function Assert-MountInputs {
    param([Parameter(Mandatory = $true)]$Mount)

    if (-not (Test-Path -LiteralPath $Mount.Source -PathType Container)) {
        throw "$($Mount.Label) 插件源码不存在：$($Mount.Source)"
    }
    if (-not (Test-Path -LiteralPath $Mount.HostRoot -PathType Container)) {
        throw "$($Mount.Label) 仓库不存在：$($Mount.HostRoot)"
    }
}

function Mount-One {
    param([Parameter(Mandatory = $true)]$Mount)

    Assert-MountInputs $Mount
    $State = Get-MountState $Mount
    if ($State.State -eq 'Occupied') {
        throw "拒绝覆盖真实目录、文件或非 Junction 链接：$($Mount.Target)"
    }
    if ($State.State -eq 'ForeignJunction') {
        throw "拒绝覆盖指向其它源码的 Junction：$($Mount.Target) -> $($State.ActualTarget)"
    }
    if ($State.State -eq 'Missing') {
        $Parent = Split-Path -Parent $Mount.Target
        if (-not (Test-Path -LiteralPath $Parent -PathType Container)) {
            New-Item -ItemType Directory -Path $Parent -Force | Out-Null
        }
        New-Item -ItemType Junction -Path $Mount.Target -Target $Mount.Source | Out-Null
    }

    $Verified = Get-MountState $Mount
    if ($Verified.State -ne 'Mounted' -or $Verified.LinkType -ne 'Junction') {
        throw "$($Mount.Label) Junction 校验失败：$($Mount.Target)"
    }
    $Pattern = Update-LocalExclude -Mount $Mount -Enabled $true
    Write-Host "$($Mount.Label)：LinkType=Junction，目标匹配" -ForegroundColor Green
    Write-Host "  $($Mount.Target) -> $($Mount.Source)"
    Write-Host "  Git 本机排除：$Pattern"
}

function Status-One {
    param([Parameter(Mandatory = $true)]$Mount)

    Assert-MountInputs $Mount
    $State = Get-MountState $Mount
    $Ignored = if ($State.State -eq 'Mounted') { Test-LocalExclude $Mount } else { $false }
    if ($State.State -eq 'Mounted' -and $State.LinkType -eq 'Junction' -and $Ignored) {
        Write-Host "$($Mount.Label)：LinkType=Junction，目标匹配，Git 本机排除有效" -ForegroundColor Green
        return $true
    }

    Write-Host "$($Mount.Label)：状态=$($State.State)，LinkType=$($State.LinkType)，Git 本机排除=$Ignored" -ForegroundColor Red
    return $false
}

function Unmount-One {
    param([Parameter(Mandatory = $true)]$Mount)

    Assert-MountInputs $Mount
    $State = Get-MountState $Mount
    if ($State.State -eq 'Occupied') {
        throw "拒绝删除真实目录、文件或非 Junction 链接：$($Mount.Target)"
    }
    if ($State.State -eq 'ForeignJunction') {
        throw "拒绝删除指向其它源码的 Junction：$($Mount.Target) -> $($State.ActualTarget)"
    }
    if ($State.State -eq 'Mounted') {
        Remove-Item -LiteralPath $Mount.Target -Force
    }
    Update-LocalExclude -Mount $Mount -Enabled $false | Out-Null
    Write-Host "$($Mount.Label)：开发 Junction 已卸载" -ForegroundColor Green
}

$Succeeded = $true
foreach ($Mount in $Mounts) {
    try {
        if ($Action -eq 'Mount') { Mount-One $Mount }
        if ($Action -eq 'Status' -and -not (Status-One $Mount)) { $Succeeded = $false }
        if ($Action -eq 'Unmount') { Unmount-One $Mount }
    } catch {
        $Succeeded = $false
        Write-Error $_
    }
}

if (-not $Succeeded) {
    exit 1
}

if ($Action -eq 'Mount') {
    Write-Host '两处 Junction 已通过 LinkType、目标与 Git 本机排除校验。请重启 Phoenix Admin Vue/Node。'
}
