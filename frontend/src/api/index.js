import axios from 'axios'

// 动态获取 API 地址，支持本地、IP 和花生壳访问
const getApiBaseURL = () => {
  // 统一使用相对路径 /api
  // Vite 会将 /api 请求代理到后端 3001 端口
  return '/api'
}

const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 10000,
  withCredentials: true
})

// 请求拦截器：自动添加 token
api.interceptors.request.use((config) => {
  try {
    const token = sessionStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else {
      console.warn('未找到 token，请先登录')
    }
  } catch (e) {
    console.warn('sessionStorage 访问失败:', e)
  }
  return config
})

// 响应拦截器：处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('认证失败，token 可能已过期或无效')
      // 清除过期的 token
      try {
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('user')
      } catch (e) {
        console.warn('清除 sessionStorage 失败:', e)
      }
    }
    return Promise.reject(error)
  }
)

// 认证相关接口
export const authApi = {
  // 登录
  login: (username, password) => api.post('/auth/login', { username, password }),
  // 注册
  register: (username, password, nickname) => api.post('/auth/register', { username, password, nickname }),
  // 登出
  logout: () => api.post('/auth/logout'),
  // 获取当前用户信息
  getMe: () => api.get('/auth/me')
}

// 基金相关接口
export const fundApi = {
  // 获取自选基金列表（含实时估值和持仓）
  getList: (groupName) => api.get('/fund/list', { params: { groupName } }),
  // 获取单个基金详情
  getDetail: (code) => api.get(`/fund/detail/${code}`),
  // 搜索基金
  search: (keyword) => api.get(`/fund/search/${keyword}`),
  // 添加自选基金
  add: (code, groupName, amount) => api.post('/fund/add', { code, groupName, amount }),
  // 批量添加基金
  batchAdd: (codes) => api.post('/fund/batch-add', { codes }),
  // 删除自选基金
  remove: (code) => api.delete(`/fund/${code}`),
  // 更新排序
  updateSort: (orders) => api.put('/fund/sort', { orders }),
  // 更新基金分组
  updateFundGroup: (code, groupName) => api.put('/fund/group', { code, groupName }),
  // 获取所有分组
  getGroups: () => api.get('/fund/groups'),
  // 获取用户的所有分组
  getUserGroups: () => api.get('/fund/user-groups/list'),
  // 创建新分组
  createGroup: (groupName) => api.post('/fund/user-groups/create', { groupName }),
  // 修改分组名称
  updateGroupName: (groupName, newGroupName) => api.put(`/fund/user-groups/${groupName}`, { newGroupName }),
  // 删除分组
  deleteGroup: (groupName) => api.delete(`/fund/user-groups/${groupName}`)
}

// 持仓/交易相关接口
export const holdingApi = {
  // 添加交易（加仓/减仓）
  trade: (data) => api.post('/holding/trade', data),
  // 直接更新持仓
  updateHolding: (data) => api.put('/holding/update', data),
  // 获取某基金的交易记录
  getTransactions: (fundCode) => api.get(`/holding/transactions/${fundCode}`),
  // 获取所有交易记录
  getAllTransactions: () => api.get('/holding/transactions'),
  // 删除交易记录
  deleteTransaction: (id) => api.delete(`/holding/transaction/${id}`)
}
