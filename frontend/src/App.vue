<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, watch, computed } from 'vue'
import { showToast } from 'vant'
import { authApi } from './api'

const route = useRoute()
const router = useRouter()
const user = ref(null)
const showMenu = ref(false)

// 读取用户信息
const loadUser = () => {
  try {
    const userStr = sessionStorage.getItem('user')
    if (userStr) {
      user.value = JSON.parse(userStr)
    }
  } catch (e) {
    console.warn('sessionStorage 访问失败:', e)
  }
}

// 立即加载用户信息
loadUser()

// 监听路由变化,重新加载用户信息(登录后会跳转路由)
watch(() => route.path, () => {
  loadUser()
})

// 是否显示导航栏和标签栏
const showNav = computed(() => {
  return user.value && route.path !== '/login'
})

// 是否显示返回箭头（只在详情页显示）
const showBackArrow = computed(() => {
  return route.path.startsWith('/fund/')
})

// 当前活跃的标签
const activeTab = computed(() => {
  const path = route.path
  if (path.startsWith('/fund/')) return 'detail'
  if (path === '/home') return 'home'
  if (path === '/watching') return 'watching'
  return 'home'
})

const handleBack = () => {
  // 如果是详情页，返回到首页
  if (route.path.startsWith('/fund/')) {
    router.push('/home')
  } else {
    router.back()
  }
}

const handleLogout = async () => {
  await authApi.logout()
  try {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  } catch (e) {
    console.warn('sessionStorage 清除失败:', e)
  }
  showToast('已登出')
  router.push('/login')
}

const handleTabChange = (tab) => {
  const routes = {
    home: '/home',
    funds: '/funds',
    watching: '/watching',
    transactions: '/transactions'
  }
  if (routes[tab]) {
    router.push(routes[tab])
  }
}
</script>

<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      v-if="showNav"
      :title="route.meta.title || '基金追踪'"
      :left-arrow="showBackArrow"
      @click-left="handleBack"
    >
      <template #right>
        <van-icon name="setting-o" size="18" @click="showMenu = !showMenu" />
      </template>
    </van-nav-bar>

    <!-- 用户菜单 -->
    <van-popup v-model:show="showMenu" position="top" :style="{ paddingTop: '46px' }">
      <div class="user-menu">
        <div class="user-info">{{ user?.nickname }}</div>
        <van-button type="danger" size="small" @click="handleLogout">登出</van-button>
      </div>
    </van-popup>

    <!-- 主内容区 -->
    <div class="main-content">
      <router-view :key="route.name" />
    </div>

    <!-- 底部标签栏（只在主要页面显示） -->
    <van-tabbar
      v-if="showNav && !route.path.startsWith('/fund/')"
      :active="activeTab"
      active-color="#1989fa"
      fixedfunds
      @change="handleTabChange"
    >
      <van-tabbar-item name="home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item name="watching" icon="star-o">关注</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f7fa;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 50px;
}

.user-menu {
  padding: 16px;
  text-align: center;
}

.user-info {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}
</style>
