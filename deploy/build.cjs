#!/usr/bin/env node

/**
 * SettlementSystem 安装包构建脚本
 *
 * 用法:
 *   node deploy/build.cjs                  # 完整安装包
 *   node deploy/build.cjs --patch          # 增量补丁包（只含前后端代码+迁移）
 *   node deploy/build.cjs --skip-frontend  # 跳过前端构建
 *   node deploy/build.cjs --skip-backend   # 跳过后端构建
 *   node deploy/build.cjs --skip-manager   # 跳过服务管理器构建
 *
 * 版本号统一从 package.json 读取，修改 version 字段即可控制版本。
 *
 * 输出目录:
 *   release/installer/v{version}/  — 全量安装包
 *   release/patch/v{version}/      — 增量补丁包
 *
 * 前置条件:
 *   - Node.js 20+
 *   - Inno Setup 6+ (安装后 iscc.exe 在 PATH 中，或安装到默认路径)
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const https = require('https')

// ============ 配置 ============

const ROOT = path.resolve(__dirname, '..')
const DEPLOY = __dirname
const NODE_VERSION = 'v20.18.3'
const NODE_ZIP = `node-${NODE_VERSION}-win-x64.zip`
const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}/${NODE_ZIP}`
const CACHE_DIR = path.join(DEPLOY, 'cache')
const OUTPUT_DIR = path.join(DEPLOY, 'output', 'app')
const RELEASE_DIR = path.join(ROOT, 'release')
const ISCC_DEFAULT = 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe'

// ============ 工具函数 ============

function run(cmd, cwd = ROOT) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function log(msg) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ${msg}`)
  console.log('='.repeat(50))
}

function rimraf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item)
    const destPath = path.join(dest, item)
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`下载: ${url}`)
    const file = fs.createWriteStream(dest)
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close()
        fs.unlinkSync(dest)
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject)
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlinkSync(dest)
      reject(err)
    })
  })
}

function findIscc() {
  // 检查 PATH
  try {
    execSync('iscc /? >nul 2>&1', { stdio: 'ignore' })
    return 'iscc'
  } catch {}

  // 检查默认安装路径
  if (fs.existsSync(ISCC_DEFAULT)) {
    return ISCC_DEFAULT
  }

  // 检查常见路径
  const candidates = [
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'D:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'D:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }

  return null
}

// ============ 主流程 ============

const args = process.argv.slice(2)
const isPatch = args.includes('--patch')
const skipFrontend = args.includes('--skip-frontend')
const skipBackend = args.includes('--skip-backend')
const skipManager = args.includes('--skip-manager')

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
  const version = pkg.version
  const mode = isPatch ? '补丁包' : '安装包'
  log(`构建 SettlementSystem v${version} (${mode})`)

  // 1. 清理旧构建
  log('[1/9] 清理旧构建产物')
  rimraf(path.join(DEPLOY, 'output'))

  // 2. 构建前端
  if (!skipFrontend) {
    log('[2/9] 构建前端')
    run('npm install', path.join(ROOT, 'frontend'))
    run('npm run build', path.join(ROOT, 'frontend'))
  } else {
    log('[2/9] 跳过前端构建')
  }

  // 3. 构建后端
  if (!skipBackend) {
    log('[3/9] 构建后端')
    run('npm install', path.join(ROOT, 'backend'))
    run('npm run build', path.join(ROOT, 'backend'))
  } else {
    log('[3/9] 跳过后端构建')
  }

  // 4. 构建 Tauri 服务管理器（仅全量安装包）
  if (!skipManager && !isPatch) {
    log('[4/9] 构建服务管理器 (Tauri)')
    const managerDir = path.join(ROOT, 'service-manager')
    run('npm install', managerDir)
    run('npm run tauri build', managerDir)
  } else {
    log('[4/9] 跳过服务管理器构建')
  }

  // 5. 创建输出目录结构
  log('[5/9] 组装文件')
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // 复制前端构建产物
  copyDir(path.join(ROOT, 'frontend', 'dist'), path.join(OUTPUT_DIR, 'frontend', 'dist'))

  // 复制后端编译产物
  copyDir(path.join(ROOT, 'backend', 'dist'), path.join(OUTPUT_DIR, 'backend', 'dist'))

  // 复制 prisma 目录（schema + migrations，不含 data）
  const prismaSrc = path.join(ROOT, 'backend', 'prisma')
  const prismaDest = path.join(OUTPUT_DIR, 'backend', 'prisma')
  fs.mkdirSync(path.join(prismaDest, 'data'), { recursive: true })
  // 复制 schema.prisma
  fs.copyFileSync(path.join(prismaSrc, 'schema.prisma'), path.join(prismaDest, 'schema.prisma'))
  // 复制 migrations 目录
  const migrationsSrc = path.join(prismaSrc, 'migrations')
  if (fs.existsSync(migrationsSrc)) {
    copyDir(migrationsSrc, path.join(prismaDest, 'migrations'))
  }
  // 复制 migration_lock.toml
  const lockSrc = path.join(prismaSrc, 'migration_lock.toml')
  if (fs.existsSync(lockSrc)) {
    fs.copyFileSync(lockSrc, path.join(prismaDest, 'migration_lock.toml'))
  }

  // 6. 创建生产 node_modules（仅全量安装包）
  if (!isPatch) {
    log('[6/9] 创建生产依赖')
    const backendPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend', 'package.json'), 'utf-8'))
    const prodDeps = backendPkg.dependencies || {}
    prodDeps['prisma'] = backendPkg.devDependencies?.prisma || '^5.20.0'

    const tempPkg = {
      name: 'settlement-system-prod',
      version: '1.0.0',
      dependencies: prodDeps
    }
    const tempDir = path.join(DEPLOY, 'output', 'temp')
    fs.mkdirSync(tempDir, { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(tempPkg, null, 2))

    run('npm install --production', tempDir)

    const nodeModulesDest = path.join(OUTPUT_DIR, 'backend', 'node_modules')
    fs.renameSync(path.join(tempDir, 'node_modules'), nodeModulesDest)
    rimraf(tempDir)

    // 复制 backend 的 package.json（prisma 需要）
    fs.copyFileSync(
      path.join(ROOT, 'backend', 'package.json'),
      path.join(OUTPUT_DIR, 'backend', 'package.json')
    )
  } else {
    log('[6/9] 跳过（补丁包不含 node_modules）')
  }

  // 7. 运行 prisma generate（仅全量安装包）
  if (!isPatch) {
    log('[7/9] 生成 Prisma Client')
    const nodeExe = path.join(CACHE_DIR, 'node', 'node.exe')
    if (fs.existsSync(nodeExe)) {
      run(`"${nodeExe}" node_modules/prisma/build/index.js generate`, path.join(OUTPUT_DIR, 'backend'))
    } else {
      run('npx prisma generate', path.join(OUTPUT_DIR, 'backend'))
    }
  } else {
    log('[7/9] 跳过（补丁包不含 prisma generate）')
  }

  // 8. 下载 Node.js 便携版（仅全量安装包）
  if (!isPatch) {
    log('[8/9] 下载 Node.js 便携版')
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const zipPath = path.join(CACHE_DIR, NODE_ZIP)
  const nodeDir = path.join(CACHE_DIR, 'node')

  if (!fs.existsSync(path.join(nodeDir, 'node.exe'))) {
    rimraf(nodeDir)
    await downloadFile(NODE_URL, zipPath)
    // 解压
    run(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${CACHE_DIR}' -Force"`)
    // 重命名解压后的目录
    const extractedDir = path.join(CACHE_DIR, `node-${NODE_VERSION}-win-x64`)
    if (fs.existsSync(extractedDir)) {
      if (fs.existsSync(nodeDir)) rimraf(nodeDir)
      fs.renameSync(extractedDir, nodeDir)
    }
    // 清理 zip
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
    console.log('Node.js 便携版已下载并缓存')
  } else {
    console.log('Node.js 便携版已缓存，跳过下载')
  }

  // 复制 Node.js 到输出目录
  copyDir(nodeDir, path.join(OUTPUT_DIR, 'node'))
  } else {
    log('[8/9] 跳过（补丁包不含 Node.js）')
  }

  // 9. 复制服务管理器和部署脚本
  log('[9/9] 复制服务管理器')

  // 复制 Tauri 构建产物 (manager.exe)
  const tauriRelease = path.join(ROOT, 'service-manager', 'src-tauri', 'target', 'release')
  const managerExe = path.join(tauriRelease, 'settlement-service-manager.exe')
  if (fs.existsSync(managerExe)) {
    fs.copyFileSync(managerExe, path.join(OUTPUT_DIR, 'manager.exe'))
    console.log('已复制 manager.exe')
  } else {
    console.warn('警告: 未找到 manager.exe，跳过')
  }

  // 复制 first-run.bat 和创建 .env（仅全量安装包）
  if (!isPatch) {
    fs.copyFileSync(path.join(DEPLOY, 'first-run.bat'), path.join(OUTPUT_DIR, 'first-run.bat'))

    const envContent = [
      'DATABASE_URL="file:./data/settlement.db"',
      'JWT_SECRET="settlement-system-secret-key-change-in-production"',
      'JWT_EXPIRES_IN="7d"',
      'PORT=4000',
      'NODE_ENV="production"'
    ].join('\n')
    fs.writeFileSync(path.join(OUTPUT_DIR, 'backend', '.env'), envContent)
  }

  // 创建 logs 目录
  fs.mkdirSync(path.join(OUTPUT_DIR, 'logs'), { recursive: true })

  // 复制图标（如果存在）
  const iconSrc = path.join(ROOT, 'assets', 'settlement.ico')
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(OUTPUT_DIR, 'SettlementSystem.ico'))
  }

  // 9. 编译 Inno Setup
  log(`编译 Inno Setup ${mode}`)
  const iscc = findIscc()
  if (!iscc) {
    console.error('\n错误: 未找到 Inno Setup (ISCC.exe)')
    console.error('请安装 Inno Setup 6+: https://jrsoftware.org/isinfo.php')
    console.error('安装后确保 iscc.exe 在 PATH 中，或安装到默认路径')
    process.exit(1)
  }

  const sourceDirAbs = path.resolve(OUTPUT_DIR)
  const issScript = isPatch ? path.join(DEPLOY, 'patch.iss') : path.join(DEPLOY, 'installer.iss')
  run(`"${iscc}" /DAppVersion=${version} /DSourceDir="${sourceDirAbs}" "${issScript}"`)

  // 完成
  const subDir = isPatch ? 'patch' : 'installer'
  const outputExe = path.join(RELEASE_DIR, subDir, `v${version}`, `SettlementSystem-${version}-${isPatch ? 'Patch' : 'Setup'}.exe`)
  if (fs.existsSync(outputExe)) {
    const stats = fs.statSync(outputExe)
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1)
    log(`构建完成!`)
    console.log(`输出: ${outputExe}`)
    console.log(`大小: ${sizeMB} MB`)
  } else {
    log('构建完成，但未找到输出文件')
    console.log('请检查 Inno Setup 编译输出')
  }
}

main().catch(err => {
  console.error('\n构建失败:', err.message)
  process.exit(1)
})
