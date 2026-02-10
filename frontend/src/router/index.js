import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '首页', requiresAuth: true }
  },
  {
    path: '/watching',
    name: 'Watching',
    component: () => import('../views/Watching.vue'),
    meta: { title: '关注基金', requiresAuth: true }
  },
  {
    path: '/fund/:code',
    name: 'FundDetail',
    component: () => import('../views/FundDetail.vue'),
    meta: { title: '基金详情', requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 获取 token 的安全方法
const getToken = () => {
  try {
    return sessionStorage.getItem('token')
  } catch (e) {
    console.warn('sessionStorage 访问失败:', e)
    return null
  }
}

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = getToken()
  const requiresAuth = to.meta.requiresAuth

  // 如果需要认证但没有 token，重定向到登录
  if (requiresAuth && !token) {
    next('/login')
  }
  // 如果已登录但访问登录页，重定向到首页
  else if (to.path === '/login' && token) {
    next('/home')
  }
  // 其他情况正常跳转
  else {
    next()
  }
})

export default router
