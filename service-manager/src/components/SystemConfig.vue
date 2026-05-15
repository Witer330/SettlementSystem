<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Edit, Check, Link, QuestionFilled } from '@element-plus/icons-vue'

const emit = defineEmits<{
  configChanged: []
}>()

interface Config {
  proxy_port: number
  host: string
  external_url: string | null
}

const config = reactive<Config>({ proxy_port: 4000, host: '0.0.0.0', external_url: null })
const lanIp = ref('127.0.0.1')
const portEditing = ref(false)
const portSaving = ref(false)
const autoStart = ref(false)
const autoStartLoading = ref(false)
const externalEditing = ref(false)
const externalInput = ref('')

const localUrl = computed(() => `http://localhost:${config.proxy_port}`)
const lanUrl = computed(() => `http://${lanIp.value}:${config.proxy_port}`)
const externalUrl = computed(() => config.external_url || '')

onMounted(async () => {
  try {
    const c = await invoke<Config>('get_config')
    config.proxy_port = c.proxy_port
    config.host = c.host
    config.external_url = c.external_url ?? null
    externalInput.value = config.external_url || ''
  } catch { /* ignore */ }
  try {
    lanIp.value = await invoke<string>('get_lan_ip')
  } catch { /* ignore */ }
  try {
    autoStart.value = await invoke<boolean>('is_autostart_enabled')
  } catch { /* ignore */ }
})

function copyUrl(url: string) {
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

async function createShortcut(url: string) {
  try {
    await invoke('create_desktop_shortcut', { url })
    ElMessage.success('桌面快捷方式已创建')
  } catch (e: any) {
    ElMessage.error(e?.message || '创建快捷方式失败')
  }
}

async function saveExternalUrl() {
  const url = externalInput.value.trim()
  config.external_url = url || null
  try {
    await invoke('save_config', { newConfig: { proxy_port: config.proxy_port, host: config.host, external_url: config.external_url } })
    ElMessage.success('外网地址已保存')
    externalEditing.value = false
  } catch {
    ElMessage.error('保存失败')
  }
}

function showExternalHelp() {
  ElMessageBox.alert(
    `<div style="line-height:1.8;font-size:13px;">
      <p><b>方式一：公网 IP + 端口映射</b></p>
      <p>1. 获取路由器的公网 IP（在路由器管理页面查看 WAN 口 IP）</p>
      <p>2. 登录路由器管理页面，找到「端口映射」或「虚拟服务器」设置</p>
      <p>3. 添加映射规则：外部端口 <code>${config.proxy_port}</code> → 内部 IP（本机局域网 IP）端口 <code>${config.proxy_port}</code></p>
      <p>4. 通过 <code>http://公网IP:${config.proxy_port}</code> 访问</p>
      <p style="color:#999;margin-top:8px;">注意：部分运营商会封锁 80/443 端口，建议使用高位端口。</p>
      <p style="margin-top:12px;"><b>方式二：域名访问（推荐）</b></p>
      <p>1. 注册域名（如阿里云、腾讯云等域名服务商）</p>
      <p>2. 安装内网穿透工具（如 frp、Cloudflare Tunnel、花生壳）</p>
      <p>3. 将域名 A 记录指向公网 IP，或配置穿透工具的自定义域名</p>
      <p>4. 通过 <code>http://你的域名:端口</code> 访问</p>
      <p style="color:#999;margin-top:8px;">内网穿透工具可免去端口映射配置，适合无公网 IP 的场景。</p>
      <p style="margin-top:12px;"><b>方式三：Tailscale / ZeroTier 组网</b></p>
      <p>1. 在本机和访问端设备均安装 Tailscale（或 ZeroTier）</p>
      <p>2. 同一账号登录后自动组网</p>
      <p>3. 通过 Tailscale 分配的 IP 直接访问，无需端口映射</p>
      <p style="color:#999;margin-top:8px;">适合远程办公，安全性高，无需暴露公网端口。</p>
     </div>`,
    '外网访问配置说明',
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '我知道了',
      customStyle: { maxWidth: '520px' },
    }
  )
}

async function savePort() {
  portSaving.value = true
  try {
    const available = await invoke<boolean>('check_port', { port: config.proxy_port })
    if (!available) {
      ElMessage.warning('端口被占用，请更换')
      return
    }
    await invoke('save_config', { newConfig: { proxy_port: config.proxy_port, host: config.host } })
    ElMessage.success('配置已保存，重启服务后生效')
    portEditing.value = false
    emit('configChanged')
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    portSaving.value = false
  }
}

async function toggleAutoStart(val: boolean) {
  autoStartLoading.value = true
  try {
    if (val) {
      await invoke('enable_autostart')
      ElMessage.success('已启用开机自启动')
    } else {
      await invoke('disable_autostart')
      ElMessage.success('已关闭开机自启动')
    }
  } catch (e: any) {
    autoStart.value = !val // 回滚开关状态
    ElMessage.error(e?.message || '操作失败')
  } finally {
    autoStartLoading.value = false
  }
}
</script>

<template>
  <div class="card config-panel">
    <div class="panel-header">
      <span class="text-h3">系统配置与连接</span>
    </div>

    <!-- 网络连接 -->
    <div class="section">
      <div class="section-title text-xs">网络连接</div>

      <div class="url-row">
        <div class="url-info">
          <span class="text-xs url-label">本地访问</span>
          <span class="text-small text-mono-small url-value">{{ localUrl }}</span>
        </div>
        <div class="url-actions">
          <button class="btn btn-sm btn-white" @click="copyUrl(localUrl)">
            <el-icon :size="14"><CopyDocument /></el-icon>
          </button>
          <button class="btn btn-sm btn-white" @click="createShortcut(localUrl)" title="创建桌面快捷方式">
            <el-icon :size="14"><Link /></el-icon>
          </button>
        </div>
      </div>

      <div class="url-row">
        <div class="url-info">
          <span class="text-xs url-label">局域网访问</span>
          <span class="text-small text-mono-small url-value">{{ lanUrl }}</span>
        </div>
        <div class="url-actions">
          <button class="btn btn-sm btn-white" @click="copyUrl(lanUrl)">
            <el-icon :size="14"><CopyDocument /></el-icon>
          </button>
          <button class="btn btn-sm btn-white" @click="createShortcut(lanUrl)" title="创建桌面快捷方式">
            <el-icon :size="14"><Link /></el-icon>
          </button>
        </div>
      </div>

      <!-- 外网访问 -->
      <div class="url-row">
        <div class="url-info" style="flex:1;">
          <div class="url-external-header">
            <span class="text-xs url-label">外网访问</span>
            <button class="btn-help" @click="showExternalHelp" title="配置说明">
              <el-icon :size="12"><QuestionFilled /></el-icon>
            </button>
          </div>
          <template v-if="!externalEditing">
            <span v-if="externalUrl" class="text-small text-mono-small url-value" @click="externalEditing = true" style="cursor:pointer;">{{ externalUrl }}</span>
            <span v-else class="text-small url-value url-placeholder" @click="externalEditing = true" style="cursor:pointer;">点击设置外网访问地址</span>
          </template>
          <template v-else>
            <div class="external-input-group">
              <el-input
                v-model="externalInput"
                size="small"
                placeholder="如 http://公网IP:端口 或 http://域名:端口"
                @keyup.enter="saveExternalUrl"
                @keyup.escape="externalEditing = false"
                style="flex:1;"
              />
              <button class="btn btn-sm btn-primary" @click="saveExternalUrl">
                <el-icon :size="14"><Check /></el-icon>
              </button>
              <button class="btn btn-sm btn-white" @click="externalEditing = false">
                <el-icon :size="14"><CopyDocument /></el-icon>
              </button>
            </div>
          </template>
        </div>
        <template v-if="externalUrl && !externalEditing">
          <div class="url-actions">
            <button class="btn btn-sm btn-white" @click="copyUrl(externalUrl)">
              <el-icon :size="14"><CopyDocument /></el-icon>
            </button>
            <button class="btn btn-sm btn-white" @click="createShortcut(externalUrl)" title="创建桌面快捷方式">
              <el-icon :size="14"><Link /></el-icon>
            </button>
            <button class="btn btn-sm btn-white" @click="externalEditing = true">
              <el-icon :size="14"><Edit /></el-icon>
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- 配置控制 -->
    <div class="section">
      <div class="section-title text-xs">配置控制</div>

      <!-- 开机自启动 -->
      <div class="control-row">
        <span class="text-small control-label">开机自动启动</span>
        <el-switch
          v-model="autoStart"
          size="small"
          :loading="autoStartLoading"
          @change="toggleAutoStart"
        />
      </div>

      <!-- 端口配置 -->
      <div class="control-row port-row">
        <span class="text-small control-label">服务端口</span>
        <div class="port-input-group">
          <el-input-number
            v-model="config.proxy_port"
            :min="1024"
            :max="65535"
            :disabled="!portEditing"
            size="small"
            controls-position="right"
            class="port-input"
          />
          <button
            v-if="!portEditing"
            class="btn btn-sm btn-white"
            @click="portEditing = true"
          >
            <el-icon :size="14"><Edit /></el-icon>
          </button>
          <button
            v-else
            class="btn btn-sm btn-primary"
            :disabled="portSaving"
            @click="savePort"
          >
            <el-icon :size="14"><Check /></el-icon>
            保存并应用
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-color-light);
}

.section {
  margin-top: var(--space-4);
}

.section-title {
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-3);
}

.url-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-canvas);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
}

.url-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.url-label {
  color: var(--color-text-muted);
}

.url-value {
  color: var(--color-text-primary);
}

.url-actions {
  display: flex;
  gap: var(--space-1);
}

.url-external-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-help {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: var(--border-color-light);
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}
.btn-help:hover {
  background: var(--color-primary);
  color: #fff;
}

.url-placeholder {
  color: var(--color-text-muted);
  font-style: italic;
  font-family: inherit;
  letter-spacing: normal;
}

.external-input-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
}

.control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
}

.control-label {
  color: var(--color-text-secondary);
}

.port-row {
  flex-wrap: wrap;
  gap: var(--space-2);
}

.port-input-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.port-input {
  width: 120px;
}

/* Element Plus 深色主题覆盖 */
:deep(.el-input-number.is-disabled .el-input__wrapper) {
  background-color: var(--bg-canvas);
  box-shadow: 0 0 0 1px var(--border-color) inset;
}

:deep(.el-input-number.is-disabled .el-input__inner) {
  color: var(--color-text-muted);
}

:deep(.el-input-number.is-disabled .el-input-number__decrease),
:deep(.el-input-number.is-disabled .el-input-number__increase) {
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
}

:deep(.el-switch.is-checked .el-switch__core) {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

:deep(.el-input__wrapper) {
  background-color: var(--bg-canvas);
  box-shadow: 0 0 0 1px var(--border-color) inset;
}

:deep(.el-input__inner) {
  color: var(--color-text-primary);
}

:deep(.el-input-number__decrease),
:deep(.el-input-number__increase) {
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
  color: var(--color-text-secondary);
}
</style>
