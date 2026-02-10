// 登出接口
const { supabase } = require('../_lib/supabase')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    const userId = parseInt(token.split('-')[0])
    if (!isNaN(userId)) {
      await supabase.from('users').update({ token: null }).eq('id', userId)
    }
  }

  res.json({ success: true, message: '登出成功' })
}
