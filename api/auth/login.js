// 登录接口
const { supabase } = require('../_lib/supabase')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

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

  // 生成 token
  const token = `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  await supabase.from('users').update({ token }).eq('id', user.id)

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, username: user.username, nickname: user.nickname }
    }
  })
}
