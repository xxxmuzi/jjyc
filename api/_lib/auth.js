// 认证中间件
const { supabase } = require('./supabase')

/**
 * 从请求头中提取 token 并验证用户身份
 * @param {object} req - 请求对象
 * @returns {number|null} 用户 ID，验证失败返回 null
 */
async function getUserId(req) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null

  const token = authHeader.split(' ')[1]
  if (!token) return null

  const userId = parseInt(token.split('-')[0])
  if (isNaN(userId)) return null

  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('token', token)
    .single()

  return data ? data.id : null
}

/**
 * 返回 401 未授权响应
 */
function unauthorized(res) {
  return res.status(401).json({ success: false, message: '未授权' })
}

module.exports = { getUserId, unauthorized }
