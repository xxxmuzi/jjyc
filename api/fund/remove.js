// 删除自选基金
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  // 从 URL 中提取基金代码：/api/fund/remove?code=xxx
  const code = req.query.code
  if (!code) {
    return res.json({ success: false, message: '缺少基金代码' })
  }

  await supabase.from('transactions').delete().eq('user_id', userId).eq('fund_code', code)
  await supabase.from('holdings').delete().eq('user_id', userId).eq('fund_code', code)
  await supabase.from('funds').delete().eq('user_id', userId).eq('code', code)

  res.json({ success: true })
}
