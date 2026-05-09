# SettlementSystem 系统托盘应用
# 开机自启动，右键控制服务启停

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = $PSScriptRoot
$nodePath = Join-Path $scriptDir "node\node.exe"
$serverScript = Join-Path $scriptDir "backend\dist\index.js"
$backendDir = Join-Path $scriptDir "backend"
$pidFile = Join-Path $scriptDir "server.pid"
$logFile = Join-Path $scriptDir "logs\server.log"
$serverUrl = "http://localhost:4000"

# 确保 logs 目录存在
if (-not (Test-Path (Join-Path $scriptDir "logs"))) {
    New-Item -ItemType Directory -Path (Join-Path $scriptDir "logs") | Out-Null
}

# --- NotifyIcon 设置 ---
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$iconPath = Join-Path $scriptDir "SettlementSystem.ico"
if (Test-Path $iconPath) {
    $notifyIcon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($iconPath)
} else {
    $notifyIcon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon("$env:SystemRoot\System32\shell32.dll")
}
$notifyIcon.Text = "SettlementSystem - Stopped"
$notifyIcon.Visible = $true

# --- 右键菜单 ---
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$itemStart = $menu.Items.Add("启动服务")
$itemStart.Tag = "start"
$itemStop = $menu.Items.Add("停止服务")
$itemStop.Tag = "stop"
$itemStop.Enabled = $false
$menu.Items.Add("-") | Out-Null  # 分隔线
$itemBrowser = $menu.Items.Add("打开浏览器")
$itemBrowser.Tag = "browser"
$itemLogs = $menu.Items.Add("查看日志")
$itemLogs.Tag = "logs"
$menu.Items.Add("-") | Out-Null  # 分隔线
$itemExit = $menu.Items.Add("退出")
$itemExit.Tag = "exit"

$notifyIcon.ContextMenuStrip = $menu

# --- 状态变量 ---
$script:nodeProcess = $null

# --- 函数 ---

function Start-Server {
    if ($script:nodeProcess -and -not $script:nodeProcess.HasExited) {
        return
    }

    $env:NODE_ENV = "production"
    $env:PORT = "4000"

    $script:nodeProcess = Start-Process -FilePath $nodePath `
        -ArgumentList $serverScript `
        -WorkingDirectory $backendDir `
        -NoNewWindow `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError (Join-Path $scriptDir "logs\error.log") `
        -PassThru

    # 写入 PID 文件
    $script:nodeProcess.Id | Out-File -FilePath $pidFile -Encoding ASCII

    Start-Sleep -Seconds 2

    if ($script:nodeProcess -and -not $script:nodeProcess.HasExited) {
        $notifyIcon.Text = "SettlementSystem - Running (port 4000)"
        $notifyIcon.ShowBalloonTip(3000, "SettlementSystem", "服务已启动", [System.Windows.Forms.ToolTipIcon]::Info)
        $itemStart.Enabled = $false
        $itemStop.Enabled = $true
    } else {
        $notifyIcon.ShowBalloonTip(5000, "SettlementSystem", "服务启动失败，请查看日志", [System.Windows.Forms.ToolTipIcon]::Error)
    }
}

function Stop-Server {
    # 优先通过进程引用停止
    if ($script:nodeProcess -and -not $script:nodeProcess.HasExited) {
        try {
            $script:nodeProcess.Kill()
            $script:nodeProcess.WaitForExit(5000)
        } catch {
            # 回退到 PID 文件方式
        }
    }

    # 通过 PID 文件停止（兜底）
    if (Test-Path $pidFile) {
        $pid = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($pid) {
            try { Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue } catch {}
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }

    $script:nodeProcess = $null
    $notifyIcon.Text = "SettlementSystem - Stopped"
    $notifyIcon.ShowBalloonTip(3000, "SettlementSystem", "服务已停止", [System.Windows.Forms.ToolTipIcon]::Info)
    $itemStart.Enabled = $true
    $itemStop.Enabled = $false
}

# --- 菜单事件 ---

$itemStart.Add_Click({ Start-Server })
$itemStop.Add_Click({ Stop-Server })

$itemBrowser.Add_Click({
    Start-Process $serverUrl
})

$itemLogs.Add_Click({
    if (Test-Path $logFile) {
        Start-Process notepad.exe $logFile
    } else {
        $notifyIcon.ShowBalloonTip(3000, "SettlementSystem", "日志文件不存在", [System.Windows.Forms.ToolTipIcon]::Warning)
    }
})

$itemExit.Add_Click({
    Stop-Server
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

# --- 健康检查定时器 ---
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 30000  # 30秒
$timer.Add_Tick({
    if ($itemStop.Enabled -and $script:nodeProcess -and $script:nodeProcess.HasExited) {
        $script:nodeProcess = $null
        $notifyIcon.Text = "SettlementSystem - Stopped"
        $notifyIcon.ShowBalloonTip(5000, "SettlementSystem", "服务异常停止", [System.Windows.Forms.ToolTipIcon]::Error)
        $itemStart.Enabled = $true
        $itemStop.Enabled = $false
        if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
    }
})
$timer.Start()

# --- 保持窗口运行 ---
$appContext = New-Object System.Windows.Forms.ApplicationContext
[System.Windows.Forms.Application]::Run($appContext)
