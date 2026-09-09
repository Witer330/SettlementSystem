<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-box">
        <div class="login-header">
          <h1 class="text-display">{{ displayTitle }}</h1>
          <p v-if="showSubtitle" class="text-h3-light mt-2">{{ displaySubtitle }}</p>
          <p class="text-h3-light mt-4">工资核算 · 进销存 · 一体化管理</p>
        </div>

        <el-form
          ref="formRef"
          :model="loginForm"
          :rules="rules"
          label-position="top"
          class="login-form"
          @submit.prevent="handleLogin"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="loginForm.username"
              placeholder="请输入用户名"
              size="large"
              class="login-input"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              class="login-input"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item class="login-actions">
            <el-button
              type="primary"
              size="large"
              class="login-button"
              :loading="loading"
              @click="handleLogin"
            >
              登录
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-footer">
          <p class="text-small">小型工贸企业结算系统 v1.0.0</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { authApi, tokenManager } from '../api/auth'
import { settingApi } from '../api/setting'

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)

const systemName = ref('结算系统')
const companyName = ref('')
const displayTitle = computed(() => companyName.value || systemName.value)
const showSubtitle = computed(() => !!companyName.value)
const displaySubtitle = computed(() => systemName.value)
onMounted(async () => {
  const [name, company] = await Promise.all([
    settingApi.getTyped<string>('system.name'),
    settingApi.getTyped<string>('system.companyName')
  ])
  if (name) systemName.value = name
  if (company) companyName.value = company
  document.title = [company, name].filter(Boolean).join(' - ') || '结算系统'
})

const loginForm = reactive({
  username: '',
  password: ''
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  try {
    await formRef.value?.validate()
    loading.value = true

    const response = await authApi.login({
      username: loginForm.username,
      password: loginForm.password
    })

    // 保存 token 和用户信息
    tokenManager.setToken(response.token)
    tokenManager.setUser(response.user)

    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (error: any) {
    console.error('登录失败', error)
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #ff6b6b 100%);
  padding: var(--space-4);
}

.login-container {
  width: 100%;
  max-width: 440px;
}

.login-box {
  background: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--space-10);
  box-shadow: var(--shadow-lg);
}

.login-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.login-header h1 {
  font-weight: var(--font-weight-700);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-display);
  margin-bottom: var(--space-4);
}

.login-header p {
  color: var(--color-black);
  opacity: 0.7;
}

.login-form {
  margin-bottom: var(--space-6);
}

.login-input {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-330);
  letter-spacing: var(--letter-body);
}

.login-actions {
  margin-top: var(--space-6);
}

.login-button {
  width: 100%;
  height: 48px;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-480);
  letter-spacing: var(--letter-body);
}

.login-footer {
  text-align: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-dark);
}

/* Responsive */
@media (max-width: 560px) {
  .login-box {
    padding: var(--space-6);
  }

  .login-header h1 {
    font-size: var(--font-size-h1);
  }
}

@media (max-width: 400px) {
  .login-header h1 {
    font-size: var(--font-size-h2);
  }

  .login-header p {
    font-size: var(--font-size-body);
  }
}
</style>
