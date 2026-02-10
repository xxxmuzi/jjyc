import axios from 'axios'

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
  login: (username, password) =>
    api.post('/auth?action=login', { username, password }),
  register: (username, password, nickname) =>
    api.post('/auth?action=register', { username, password, nickname }),
  logout: () => api.post('/auth?action=logout'),
  getMe: () => api.get('/auth?action=me')
}

// 基金相关接口
export const fundApi = {
  getList: (groupName) =>
    api.get('/fund', { params: { action: 'list', groupName } }),
  getDetail: (code) =>
    api.get('/fund', { params: { action: 'detail', code } }),
  add: (code, groupName, amount) =>
    api.post('/fund?action=add', { code, groupName, amount }),
  batchAdd: (codes) =>
    api.post('/fund?action=batchAdd', { codes }),
  remove: (code) =>
    api.delete('/fund', { params: { action: 'remove', code } }),
  updateSort: (orders) =>
    api.put('/fund?action=sort', { orders }),
  updateFundGroup: (code, groupName) =>
    api.put('/fund?action=group', { code, groupName }),
  getGroups: () =>
    api.get('/fund', { params: { action: 'groups' } }),
  getUserGroups: () =>
    api.get('/fund', { params: { action: 'userGroups' } }),
  createGroup: (groupName) =>
    api.post('/fund?action=userGroups&subAction=create', { groupName }),
  updateGroupName: (groupName, newGroupName) =>
    api.put('/fund?action=userGroups', { groupName, newGroupName }),
  deleteGroup: (groupName) =>
    api.delete('/fund', { params: { action: 'userGroups', groupName } })
}

// 持仓/交易相关接口
export const holdingApi = {
  trade: (data) =>
    api.post('/holding?action=trade', data),
  updateHolding: (data) =>
    api.put('/holding?action=update', data),
  getTransactions: (fundCode) =>
    api.get('/holding', { params: { action: 'transactions', fundCode } }),
  getAllTransactions: () =>
    api.get('/holding', { params: { action: 'transactions' } }),
  deleteTransaction: (id) =>
    api.delete('/holding', { params: { action: 'deleteTransaction', id } })
}
