// 认证统一入口：/api/auth?action=login|register|logout|me
const { supabase } = require('./_lib/supabase')
const { getUserId } = require('./_lib/auth')
const { cors } = require('./_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const action = req.query.action || req.body?.action

  if (action === 'login') {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.json({ success: false, message: '用户名和密码不能为空' })
    }
    const { data: user } = await supabase
      .from('users')
      .select('id, username, nickname')
      .eq('username', username)
      .eq('password', password)
      .single()
    if (!user) {
      return res.json({ success: false, message: '用户名或密码错误' })
    }
    const token = `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    await supabase.from('users').update({ token }).eq('id', user.id)
    return res.json({
      success: true,
      data: { token, user: { id: user.id, username: user.username, nickname: user.nickname } }
    })
  }

  if (action === 'register') {
    const { username, password, nickname } = req.body || {}
    if (!username || !password) {
      return res.json({ success: false, message: '用户名和密码不能为空' })
    }
    const { error } = await supabase
      .from('users')
      .insert({ username, password, nickname: nickname || username })
    if (error) {
      return res.json({ success: false, message: error.code === '23505' ? '用户名已存在' : '注册失败' })
    }
    return res.json({ success: true, message: '注册成功' })
  }

  if (action === 'logout') {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      const userId = parseInt(token.split('-')[0])
      if (!isNaN(userId)) {
        await supabase.from('users').update({ token: null }).eq('id', userId)
      }
    }
    return res.json({ success: true, message: '登出成功' })
  }

  if (action === 'me') {
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ success: false, message: '未授权' })
    const { data } = await supabase
      .from('users')
      .select('id, username, nickname')
      .eq('id', userId)
      .single()
    if (!data) return res.status(401).json({ success: false, message: '未授权' })
    return res.json({ success: true, data })
  }

  res.json({ success: false, message: '未知操作' })
}
