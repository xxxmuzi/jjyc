const mysql = require('mysql2/promise')

// 创建连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fund_tracker',
  waitForConnections: true,
  connectionLimit: 10
})

// 初始化表结构
async function initDatabase() {
  const conn = await pool.getConnection()
  
  try {
    // 用户表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nickname VARCHAR(50),
        token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 自选基金表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS funds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        code VARCHAR(10) NOT NULL,
        name VARCHAR(100),
        sort_order INT DEFAULT 0,
        group_name VARCHAR(50) DEFAULT '默认分组',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_fund (user_id, code),
        INDEX idx_user_id (user_id)
      )
    `)

    // 持仓汇总表（每只基金一条记录）
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS holdings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fund_code VARCHAR(10) NOT NULL,
        shares DECIMAL(16, 4) DEFAULT 0 COMMENT '持有份额',
        cost DECIMAL(16, 2) DEFAULT 0 COMMENT '持仓成本（总投入）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_holding (user_id, fund_code),
        INDEX idx_user_id (user_id)
      )
    `)

    // 交易流水表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fund_code VARCHAR(10) NOT NULL,
        type ENUM('buy', 'sell', 'bonus', 'transfer_out', 'transfer_in') NOT NULL COMMENT '类型：加仓/减仓/分红/转出/转入',
        amount DECIMAL(16, 2) NOT NULL COMMENT '交易金额',
        shares DECIMAL(16, 4) NOT NULL COMMENT '交易份额',
        price DECIMAL(10, 4) NOT NULL COMMENT '成交净值',
        op_date DATE NOT NULL COMMENT '操作日期',
        op_time ENUM('before', 'after') NOT NULL DEFAULT 'before' COMMENT '15点前/后',
        related_fund_code VARCHAR(10) DEFAULT NULL COMMENT '转换关联基金',
        note VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_fund_code (fund_code),
        INDEX idx_op_date (op_date)
      )
    `)
    
    // 基金持股表（基金的前10大重仓股）
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS fund_holdings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fund_code VARCHAR(10) NOT NULL,
        stock_code VARCHAR(10) NOT NULL,
        stock_name VARCHAR(100) NOT NULL,
        holding_ratio DECIMAL(5, 2) NOT NULL COMMENT '持仓占比(%)',
        holding_amount DECIMAL(16, 2) COMMENT '持仓金额',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_fund_stock (fund_code, stock_code),
        INDEX idx_fund_code (fund_code)
      )
    `)
    
    // 用户分组表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS fund_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        group_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_group (user_id, group_name),
        INDEX idx_user_id (user_id)
      )
    `)
    
    // 初始化测试用户 admin/123456
    await conn.execute(`
      INSERT IGNORE INTO users (username, password, nickname) 
      VALUES ('admin', '123456', '管理员')
    `)
    
    // 初始化一些基金持股数据（示例）
    const fundHoldingsData = [
      // 南方有色金属ETF联接C (004433)
      ['004433', '000661', '紫金矿业', 1.47],
      ['004433', '601899', '中国铝业', 2.36],
      ['004433', '600362', '浙江富润', 1.95],
      ['004433', '601020', '华友钴业', 1.81],
      ['004433', '600259', '广晟有色', 0.63],
      ['004433', '600259', '宝钛股份', -0.28],
      ['004433', '600259', '赤峰黄金', -3.62],
      ['004433', '600259', '山东黄金', -1.72],
      ['004433', '600259', '中金黄金', -4.01],
      ['004433', '600259', '北方稀土', 0.55],
      // 中金黄金 (000651)
      ['000651', '601899', '中国铝业', 1.20],
      ['000651', '000661', '紫金矿业', 0.95],
      ['000651', '600362', '浙江富润', 1.50],
      ['000651', '601020', '华友钴业', 0.80],
      ['000651', '600259', '广晟有色', 0.45],
      ['000651', '600259', '宝钛股份', -0.15],
      ['000651', '600259', '赤峰黄金', -2.30],
      ['000651', '600259', '山东黄金', -1.10],
      ['000651', '600259', '中金黄金', -2.50],
      ['000651', '600259', '北方稀土', 0.35],
      // 华友钴业 (603799)
      ['603799', '000661', '紫金矿业', 1.10],
      ['603799', '601899', '中国铝业', 1.80],
      ['603799', '600362', '浙江富润', 1.20],
      ['603799', '601020', '华友钴业', 0.90],
      ['603799', '600259', '广晟有色', 0.55],
      ['603799', '600259', '宝钛股份', -0.20],
      ['603799', '600259', '赤峰黄金', -1.80],
      ['603799', '600259', '山东黄金', -0.95],
      ['603799', '600259', '中金黄金', -3.10],
      ['603799', '600259', '北方稀土', 0.40]
    ]
    
    for (const [fundCode, stockCode, stockName, ratio] of fundHoldingsData) {
      await conn.execute(`
        INSERT IGNORE INTO fund_holdings (fund_code, stock_code, stock_name, holding_ratio)
        VALUES (?, ?, ?, ?)
      `, [fundCode, stockCode, stockName, ratio])
    }
    
    // 初始化测试用户的基金和持仓数据
    const [users] = await conn.execute('SELECT id FROM users WHERE username = ?', ['admin'])
    if (users.length > 0) {
      const userId = users[0].id
      
      // 初始化默认分组
      await conn.execute(`
        INSERT IGNORE INTO fund_groups (user_id, group_name)
        VALUES (?, '默认分组')
      `, [userId])
      
      // 添加测试基金
      const testFunds = [
        ['004433', '南方有色金属ETF联接C'],
        ['000651', '中金黄金'],
        ['603799', '华友钴业']
      ]
      
      for (const [code, name] of testFunds) {
        await conn.execute(`
          INSERT IGNORE INTO funds (user_id, code, name, group_name)
          VALUES (?, ?, ?, '默认分组')
        `, [userId, code, name])
      }
      
      // 添加测试持仓
      const testHoldings = [
        ['004433', 1000, 2100],
        ['000651', 500, 1050],
        ['603799', 800, 1600]
      ]
      
      for (const [code, shares, cost] of testHoldings) {
        await conn.execute(`
          INSERT IGNORE INTO holdings (user_id, fund_code, shares, cost)
          VALUES (?, ?, ?, ?)
        `, [userId, code, shares, cost])
      }
    }
    
    console.log('数据库表初始化完成')
  } finally {
    conn.release()
  }
}

module.exports = { pool, initDatabase }
