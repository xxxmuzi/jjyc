<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { authApi } from '../api'

const router = useRouter()
const username = ref('admin')
const password = ref('123456')
const loading = ref(false)
const isLogin = ref(true)
const nickname = ref('')

const handleLogin = async () => {
  if (!username.value || !password.value) {
    showToast('请输入用户名和密码')
    return
  }

  loading.value = true
  const res = await authApi.login(username.value, password.value)
  loading.value = false

  if (res.data.success) {
    try {
      sessionStorage.setItem('token', res.data.data.token)
      sessionStorage.setItem('user', JSON.stringify(res.data.data.user))
    } catch (e) {
      console.warn('sessionStorage 保存失败:', e)
    }
    showToast('登录成功')
    router.push('/')
  } else {
    showToast(res.data.message || '登录失败')
  }
}

const handleRegister = async () => {
  if (!username.value || !password.value) {
    showToast('请输入用户名和密码')
    return
  }

  loading.value = true
  const res = await authApi.register(username.value, password.value, nickname.value)
  loading.value = false

  if (res.data.success) {
    showToast('注册成功，请登录')
    isLogin.value = true
    password.value = ''
    nickname.value = ''
  } else {
    showToast(res.data.message || '注册失败')
  }
}

const handleSubmit = () => {
  if (isLogin.value) {
    handleLogin()
  } else {
    handleRegister()
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-box">
      <h1 class="title">121121</h1>

      <van-form @submit="handleSubmit">
        <van-field
          v-model="username"
          name="username"
          label="用户名"
          placeholder="请输入用户名"
          :rules="[{ required: true, message: '请输入用户名' }]"
        />
        <van-field
          v-model="password"
          name="password"
          label="密码"
          type="password"
          placeholder="请输入密码"
          :rules="[{ required: true, message: '请输入密码' }]"
        />
        <van-field
          v-if="!isLogin"
          v-model="nickname"
          name="nickname"
          label="昵称"
          placeholder="请输入昵称（可选）"
        />

        <div style="margin: 16px 0">
          <van-button round block type="primary" native-type="submit" :loading="loading">
            {{ isLogin ? '登录' : '注册' }}
          </van-button>
        </div>
      </van-form>

      <div class="toggle-mode">
        <span v-if="isLogin" @click="isLogin = false">没有账号？立即注册</span>
        <span v-else @click="isLogin = true">已有账号？立即登录</span>
      </div>

      <div class="demo-tip">
        <p>演示账号：admin / 123456</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 16px;
}

.login-box {
  background: white;
  padding: 32px 24px;
  border-radius: 12px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.title {
  text-align: center;
  font-size: 28px;
  margin-bottom: 24px;
  color: #333;
}

.toggle-mode {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
}

.toggle-mode span {
  color: #667eea;
  cursor: pointer;
  text-decoration: underline;
}

.demo-tip {
  margin-top: 16px;
  padding: 12px;
  background: #f0f2f5;
  border-radius: 6px;
  text-align: center;
  font-size: 12px;
  color: #666;
}

.demo-tip p {
  margin: 0;
}
</style>
