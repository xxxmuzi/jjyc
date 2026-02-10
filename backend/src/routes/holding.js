const express = require('express')
const router = express.Router()
const { pool } = require('../db/database')
const { getFundEstimate } = require('../services/fundService')
const { authMiddleware } = require('./auth')

// 应用认证中间件到所有路由
router.use(authMiddleware)

// 获取某基金的交易记录
router.get('/transactions/:fundCode', async (req, res) => {
  const userId = req.userId
  const { fundCode } = req.params
  const [rows] = await pool.execute(`
    SELECT t.*, f.name as fund_name
    FROM transactions t
    LEFT JOIN funds f ON t.fund_code = f.code AND t.user_id = f.user_id
    WHERE t.user_id = ? AND t.fund_code = ?
    ORDER BY t.op_date DESC, t.created_at DESC
  `, [userId, fundCode])
  res.json({ success: true, data: rows })
})

// 获取所有交易记录
router.get('/transactions', async (req, res) => {
  const userId = req.userId
  const [rows] = await pool.execute(`
    SELECT t.*, f.name as fund_name
    FROM transactions t
    LEFT JOIN funds f ON t.fund_code = f.code AND t.user_id = f.user_id
    WHERE t.user_id = ?
    ORDER BY t.op_date DESC, t.created_at DESC
  `, [userId])
  res.json({ success: true, data: rows })
})

// 添加交易（加仓/减仓）
router.post('/trade', async (req, res) => {
  const userId = req.userId
  const { fundCode, type, amount, opDate, opTime, note } = req.body
  
  if (!fundCode || !type || !amount || !opDate) {
    return res.json({ success: false, message: '请填写完整信息' })
  }
  
  // 获取当前基金净值
  const fundInfo = await getFundEstimate(fundCode).catch(() => null)
  if (!fundInfo) {
    return res.json({ success: false, message: '获取基金净值失败' })
  }
  
  const price = parseFloat(fundInfo.netWorth)
  const amountNum = parseFloat(amount)
  const shares = (amountNum / price).toFixed(4)
  
  // 插入交易记录
  await pool.execute(`
    INSERT INTO transactions (user_id, fund_code, type, amount, shares, price, op_date, op_time, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, fundCode, type, amountNum, shares, price, opDate, opTime || 'before', note || ''])
  
  // 更新持仓汇总
  if (type === 'buy') {
    // 加仓：增加份额和成本
    await pool.execute(`
      INSERT INTO holdings (user_id, fund_code, shares, cost)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE shares = shares + ?, cost = cost + ?
    `, [userId, fundCode, shares, amountNum, shares, amountNum])
  } else if (type === 'sell') {
    // 减仓：减少份额，按比例减少成本
    const [holdings] = await pool.execute(
      'SELECT shares, cost FROM holdings WHERE user_id = ? AND fund_code = ?',
      [userId, fundCode]
    )
    if (holdings.length > 0) {
      const currentShares = parseFloat(holdings[0].shares)
      const currentCost = parseFloat(holdings[0].cost)
      const sellShares = parseFloat(shares)
      
      if (sellShares > currentShares) {
        return res.json({ success: false, message: '减仓份额超过持有份额' })
      }
      
      // 按比例计算减少的成本
      const costReduce = (sellShares / currentShares) * currentCost
      
      await pool.execute(`
        UPDATE holdings SET shares = shares - ?, cost = cost - ? WHERE user_id = ? AND fund_code = ?
      `, [sellShares, costReduce, userId, fundCode])
    }
  }
  
  // 确保基金在自选列表中
  await pool.execute(
    'INSERT IGNORE INTO funds (user_id, code, name) VALUES (?, ?, ?)',
    [userId, fundCode, fundInfo.name]
  )
  
  res.json({
    success: true,
    data: { shares, price, name: fundInfo.name }
  })
})

// 直接更新持仓
router.put('/update', async (req, res) => {
  const userId = req.userId
  const { fundCode, shares, cost } = req.body
  
  if (!fundCode || shares === undefined || cost === undefined) {
    return res.json({ success: false, message: '请填写完整信息' })
  }
  
  await pool.execute(`
    INSERT INTO holdings (user_id, fund_code, shares, cost)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE shares = ?, cost = ?
  `, [userId, fundCode, shares, cost, shares, cost])
  
  res.json({ success: true })
})

// 删除交易记录（同时回滚持仓）
router.delete('/transaction/:id', async (req, res) => {
  const userId = req.userId
  const { id } = req.params
  
  // 获取交易记录
  const [rows] = await pool.execute(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  if (rows.length === 0) {
    return res.json({ success: false, message: '记录不存在' })
  }
  
  const tx = rows[0]
  
  // 回滚持仓
  if (tx.type === 'buy') {
    await pool.execute(`
      UPDATE holdings SET shares = shares - ?, cost = cost - ? WHERE fund_code = ?
    `, [tx.shares, tx.amount, tx.fund_code])
  } else if (tx.type === 'sell') {
    // 减仓的回滚：恢复份额和成本（近似）
    const [holdings] = await pool.execute(
      'SELECT shares, cost FROM holdings WHERE fund_code = ?',
      [tx.fund_code]
    )
    if (holdings.length > 0) {
      const avgCost = parseFloat(tx.price) // 用当时的净值作为成本
      const costRestore = parseFloat(tx.shares) * avgCost
      await pool.execute(`
        UPDATE holdings SET shares = shares + ?, cost = cost + ? WHERE fund_code = ?
      `, [tx.shares, costRestore, tx.fund_code])
    }
  }
  
  // 删除记录
  await pool.execute('DELETE FROM transactions WHERE id = ?', [id])
  
  res.json({ success: true })
})

module.exports = router
