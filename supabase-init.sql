-- Supabase 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(50),
  token VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 自选基金表
CREATE TABLE IF NOT EXISTS funds (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(100),
  sort_order INT DEFAULT 0,
  group_name VARCHAR(50) DEFAULT '默认分组',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, code)
);
CREATE INDEX IF NOT EXISTS idx_funds_user_id ON funds(user_id);

-- 持仓汇总表
CREATE TABLE IF NOT EXISTS holdings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  fund_code VARCHAR(10) NOT NULL,
  shares DECIMAL(16, 4) DEFAULT 0,
  cost DECIMAL(16, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, fund_code)
);
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);

-- 交易流水表
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  fund_code VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(16, 2) NOT NULL,
  shares DECIMAL(16, 4) NOT NULL,
  price DECIMAL(10, 4) NOT NULL,
  op_date DATE NOT NULL,
  op_time VARCHAR(10) DEFAULT 'before',
  related_fund_code VARCHAR(10),
  note VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_fund_code ON transactions(fund_code);

-- 用户分组表
CREATE TABLE IF NOT EXISTS fund_groups (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  group_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, group_name)
);
CREATE INDEX IF NOT EXISTS idx_fund_groups_user_id ON fund_groups(user_id);

-- 初始化测试用户 admin/123456
INSERT INTO users (username, password, nickname)
VALUES ('admin', '123456', '管理员')
ON CONFLICT (username) DO NOTHING;

-- 初始化默认分组
INSERT INTO fund_groups (user_id, group_name)
SELECT id, '默认分组' FROM users WHERE username = 'admin'
ON CONFLICT (user_id, group_name) DO NOTHING;
