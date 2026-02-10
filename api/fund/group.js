// 更新基金分组
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const { code, groupName } = req.body || {}
  if (!code || !groupName) {
    return res.json({ success: false, message: '参数错误' })
  }

  await supabase
    .from('funds')
    .update({ group_name: groupName })
    .eq('user_id', userId)
    .eq('code', code)

  res.json({ success: true })
}
