// 注册接口
const { supabase } = require('../_lib/supabase')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const { username, password, nickname } = req.body || {}
  if (!username || !password) {
    return res.json({ success: false, message: '用户名和密码不能为空' })
  }

  const { error } = await supabase
    .from('users')
    .insert({ username, password, nickname: nickname || username })

  if (error) {
    if (error.code === '23505') {
      return res.json({ success: false, message: '用户名已存在' })
    }
    return res.json({ success: false, message: '注册失败' })
  }

  res.json({ success: true, message: '注册成功' })
}
