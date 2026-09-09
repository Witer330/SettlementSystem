; SettlementSystem Inno Setup 脚本
; 由 build.js 通过 /D 参数传入版本号和源目录

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

#ifndef SourceDir
  #define SourceDir "output\app"
#endif

[Setup]
AppName=SettlementSystem
AppVersion={#AppVersion}
AppPublisher=SettlementSystem
DefaultDirName={autopf}\SettlementSystem
DefaultGroupName=SettlementSystem
OutputDir=..\release\installer\v{#AppVersion}
OutputBaseFilename=SettlementSystem-{#AppVersion}-Setup
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\SettlementSystem.ico
SetupLogging=yes

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; 直接安装所有文件到目标目录
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; 用户配置文件仅在不存在时复制（重装时保留）
Source: "{#SourceDir}\config.json"; DestDir: "{app}"; Flags: onlyifdoesntexist ignoreversion
Source: "{#SourceDir}\backend\.env"; DestDir: "{app}\backend"; Flags: onlyifdoesntexist ignoreversion

[Dirs]
Name: "{app}\logs"
Name: "{app}\backend\prisma\data"

[Icons]
; 桌面快捷方式 - 启动服务管理器
Name: "{group}\SettlementSystem"; Filename: "{app}\manager.exe"; IconFilename: "{app}\SettlementSystem.ico"; WorkingDir: "{app}"
; 打开浏览器快捷方式
Name: "{group}\打开 SettlementSystem"; Filename: "http://localhost:4000"

[Run]
; 注册开机自启动计划任务
Filename: "schtasks"; Parameters: "/Create /TN SettlementServiceManager /TR ""{app}\manager.exe --autostart"" /SC ONLOGON /F"; StatusMsg: "正在注册开机自启动..."; Flags: runhidden waituntilterminated skipifsilent
; 启动服务管理器（自动初始化数据库）
Filename: "{app}\manager.exe"; StatusMsg: "正在启动服务管理器..."; Flags: nowait skipifsilent

[Code]
function CheckNodeInstalled(): Boolean;
var
  r: Integer;
begin
  Exec('cmd', '/c node --version >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, r);
  Result := (r = 0);
end;

function InitializeSetup(): Boolean;
var
  r: Integer;
begin
  Result := True;

  if not CheckNodeInstalled() then
  begin
    if MsgBox(
      '未检测到 Node.js 环境。' + #13#10 + #13#10 +
      'SettlementSystem 需要 Node.js 来运行后端服务。' + #13#10 + #13#10 +
      '请先安装 Node.js（推荐 v20 LTS）：' + #13#10 +
      'https://nodejs.org/zh-cn/download' + #13#10 + #13#10 +
      '安装完成后重新运行本安装程序。' + #13#10 + #13#10 +
      '是否现在打开 Node.js 下载页面？',
      mbError, MB_YESNO
    ) = IDYES then
    begin
      ShellExec('open', 'https://nodejs.org/zh-cn/download', '', '', SW_SHOW, ewNoWait, r);
    end;
    Result := False;
    Exit;
  end;
end;

procedure KillAppProcesses();
var
  resultCode: Integer;
begin
  Exec('taskkill', '/F /IM manager.exe', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
  Exec('taskkill', '/F /IM settlement-proxy.exe', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
  Sleep(1500);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  { 安装前停止旧进程 }
  if CurStep = ssInstall then
  begin
    if FileExists(ExpandConstant('{app}\manager.exe')) then
      KillAppProcesses();
  end;
end;

function InitializeUninstall(): Boolean;
var
  dlgResult: Integer;
begin
  { 停止所有进程 }
  Exec('taskkill', '/F /IM manager.exe', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);
  Exec('taskkill', '/F /IM settlement-proxy.exe', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);
  Sleep(1500);

  { 清理计划任务 }
  Exec('schtasks', '/Delete /TN SettlementServiceManager /F', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);

  Result := True;
end;
