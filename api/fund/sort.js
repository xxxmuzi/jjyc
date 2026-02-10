// 更新基金排序
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const { orders } = req.body || {}
  if (!orders || !Array.isArray(orders)) {
    return res.json({ success: false, message: '参数错误' })
  }

  for (const item of orders) {
    await supabase
      .from('funds')
      .update({ sort_order: item.sortOrder })
      .eq('user_id', userId)
      .eq('code', item.code)
  }

  res.json({ success: true })
}
