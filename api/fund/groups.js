// 获取所有分组（从基金表中去重）
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const { data } = await supabase
    .from('funds')
    .select('group_name')
    .eq('user_id', userId)

  const groups = [...new Set((data || []).map((r) => r.group_name).filter(Boolean))]
  groups.sort()

  res.json({ success: true, data: groups })
}
