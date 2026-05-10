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
; 主程序文件 - 递归复制所有内容，覆盖旧版本
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Dirs]
Name: "{app}\logs"

[Icons]
; 桌面快捷方式 - 启动服务管理器
Name: "{group}\SettlementSystem"; Filename: "{app}\manager.exe"; IconFilename: "{app}\SettlementSystem.ico"; WorkingDir: "{app}"
; 打开浏览器快捷方式
Name: "{group}\打开 SettlementSystem"; Filename: "http://localhost:4000"

[Run]
; 首次安装初始化
Filename: "{app}\first-run.bat"; Parameters: """{app}"""; StatusMsg: "正在初始化数据库..."; Flags: shellexec waituntilterminated skipifsilent
; 注册开机自启动计划任务
Filename: "schtasks"; Parameters: "/Create /TN SettlementServiceManager /TR ""{app}\manager.exe --autostart"" /SC ONLOGON /F"; StatusMsg: "正在注册开机自启动..."; Flags: runhidden waituntilterminated skipifsilent
; 安装完成后启动服务管理器（--autostart 自动拉起前后端服务）
Filename: "{app}\manager.exe"; Parameters: "--autostart"; StatusMsg: "正在启动服务..."; Flags: runhidden nowait skipifsilent

[Code]
var
  isUpdate: Boolean;

function InitializeSetup(): Boolean;
begin
  Result := True;
  isUpdate := False;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  resultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    { 检测是否为更新安装 }
    if FileExists(ExpandConstant('{app}\manager.exe')) then
    begin
      isUpdate := True;
      { 停止正在运行的服务管理器 }
      Exec('taskkill', '/F /IM manager.exe', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
      { 等待进程退出 }
      Sleep(1000);
      { 备份数据库 }
      if FileExists(ExpandConstant('{app}\backend\prisma\data\settlement.db')) then
      begin
        CopyFile(
          ExpandConstant('{app}\backend\prisma\data\settlement.db'),
          ExpandConstant('{app}\backend\prisma\data\settlement.db.bak'),
          False
        );
      end;
    end;
  end;

  { 安装完成后更新计划任务路径（更新安装时 exe 路径可能变化） }
  if CurStep = ssPostInstall then
  begin
    Exec('schtasks', '/Delete /TN SettlementServiceManager /F', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
    Exec('schtasks', '/Create /TN SettlementServiceManager /TR ""' + ExpandConstant('{app}\manager.exe') + ' --autostart"" /SC ONLOGON /F', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
  end;
end;

function InitializeUninstall(): Boolean;
var
  dlgResult: Integer;
begin
  { 先停止服务 }
  Exec('taskkill', '/F /IM manager.exe', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);
  Sleep(500);

  { 清理计划任务（开机自启动） }
  Exec('schtasks', '/Delete /TN SettlementServiceManager /F', '', SW_HIDE, ewWaitUntilTerminated, dlgResult);

  dlgResult := MsgBox(
    '是否保留数据库文件？(settlement.db)',
    mbConfirmation, MB_YESNO
  );
  if dlgResult = IDNO then
  begin
    DelTree(ExpandConstant('{app}\backend\prisma\data'), True, True, True);
  end;
  Result := True;
end;
