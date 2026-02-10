// 获取当前用户信息
const { getUserId, unauthorized } = require('../_lib/auth')
const { supabase } = require('../_lib/supabase')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const { data } = await supabase
    .from('users')
    .select('id, username, nickname')
    .eq('id', userId)
    .single()

  if (!data) return unauthorized(res)
  res.json({ success: true, data })
}
