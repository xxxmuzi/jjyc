import axios from 'axios'

// API 基础路径，Vercel 部署时前后端同域，直接用 /api
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true
})

// 请求拦截器：自动添加 token
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
    }
    return Promise.reject(error)
  }
)

// 认证相关接口
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (username, password, nickname) =>
    api.post('/auth/register', { username, password, nickname }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me')
}

// 基金相关接口
export const fundApi = {
  getList: (groupName) => api.get('/fund/list', { params: { groupName } }),
  getDetail: (code) => api.get('/fund/detail', { params: { code } }),
  search: (keyword) => api.get('/fund/list', { params: { keyword } }),
  add: (code, groupName, amount) => api.post('/fund/add', { code, groupName, amount }),
  batchAdd: (codes) => api.post('/fund/batch-add', { codes }),
  remove: (code) => api.delete('/fund/remove', { params: { code } }),
  updateSort: (orders) => api.put('/fund/sort', { orders }),
  updateFundGroup: (code, groupName) => api.put('/fund/group', { code, groupName }),
  getGroups: () => api.get('/fund/groups'),
  getUserGroups: () => api.get('/fund/user-groups'),
  createGroup: (groupName) =>
    api.post('/fund/user-groups', { groupName }, { params: { action: 'create' } }),
  updateGroupName: (groupName, newGroupName) =>
    api.put('/fund/user-groups', { groupName, newGroupName }),
  deleteGroup: (groupName) =>
    api.delete('/fund/user-groups', { params: { groupName } })
}

// 持仓/交易相关接口
export const holdingApi = {
  trade: (data) => api.post('/holding/trade', data),
  updateHolding: (data) => api.put('/holding/update', data),
  getTransactions: (fundCode) =>
    api.get('/holding/transactions', { params: { fundCode } }),
  getAllTransactions: () => api.get('/holding/transactions'),
  deleteTransaction: (id) =>
    api.delete('/holding/delete-transaction', { params: { id } })
}
