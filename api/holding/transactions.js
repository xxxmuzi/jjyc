// 获取交易记录
const { supabase } = require('../_lib/supabase')
const { getUserId, unauthorized } = require('../_lib/auth')
const { cors } = require('../_lib/cors')

module.exports = async (req, res) => {
  if (cors(req, res)) return

  const userId = await getUserId(req)
  if (!userId) return unauthorized(res)

  const fundCode = req.query.fundCode

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('op_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (fundCode) {
    query = query.eq('fund_code', fundCode)
  }

  const { data } = await query

  // 补充基金名称
  if (data && data.length > 0) {
    const codes = [...new Set(data.map((t) => t.fund_code))]
    const { data: funds } = await supabase
      .from('funds')
      .select('code, name')
      .eq('user_id', userId)
      .in('code', codes)

    const nameMap = {}
    if (funds) {
      funds.forEach((f) => { nameMap[f.code] = f.name })
    }

    data.forEach((t) => { t.fund_name = nameMap[t.fund_code] || '' })
  }

  res.json({ success: true, data: data || [] })
}
