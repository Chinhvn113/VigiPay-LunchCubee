# DATABASE SCHEMA - NAVER BANK

## 📊 Tables Overview

### 1️⃣ **users** (Core User Table)
- `id` INTEGER PRIMARY KEY
- `username` VARCHAR(50) UNIQUE
- `email` VARCHAR(100) UNIQUE
- `hashed_password` VARCHAR(255)
- `full_name` VARCHAR(100)
- `is_active` BOOLEAN
- `is_verified` BOOLEAN
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP
- `Fraud_Checking` BOOLEAN

**Purpose**: Store user authentication and profile information

---

### 2️⃣ **bank_accounts** (User Bank Accounts)
- `id` INTEGER PRIMARY KEY
- `user_id` INTEGER → FK(users.id)
- `account_number` VARCHAR(10) UNIQUE
- `account_type` VARCHAR(20) (checking/savings)
- `balance` INTEGER (in cents/smallest currency unit)
- `currency` VARCHAR(3) (VND/USD)
- `is_active` BOOLEAN
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

**Purpose**: Manage multiple bank accounts per user

---

### 3️⃣ **transactions** (Transaction History)
- `id` INTEGER PRIMARY KEY
- `user_id` INTEGER → FK(users.id)
- `account_id` INTEGER → FK(bank_accounts.id)
- `transfer_id` INTEGER → FK(transfer_transactions.id)
- `type` VARCHAR(20) (deposit/withdrawal/transfer)
- `amount` INTEGER
- `description` VARCHAR(255)
- `transaction_date` TIMESTAMP
- `created_at` TIMESTAMP

**Purpose**: Record all financial transactions

---

### 4️⃣ **transfer_transactions** (Money Transfers)
- `id` INTEGER PRIMARY KEY
- `sender_account_id` INTEGER → FK(bank_accounts.id)
- `receiver_account_number` VARCHAR(50)
- `receiver_bank` VARCHAR(50)
- `receiver_name` VARCHAR(100)
- `amount` INTEGER
- `fee` INTEGER
- `fee_payer` VARCHAR(10) (sender/receiver)
- `description` VARCHAR(255)
- `status` VARCHAR(20) (pending/completed/failed)
- `transaction_date` TIMESTAMP
- `created_at` TIMESTAMP

**Purpose**: Track inter-bank and intra-bank transfers

---

### 5️⃣ **savings_goals** (Financial Goals)
- `id` INTEGER PRIMARY KEY
- `user_id` INTEGER → FK(users.id)
- `account_id` INTEGER → FK(bank_accounts.id)
- `name` VARCHAR(100) (Goal name like "Vacation", "New Car")
- `target_amount` DOUBLE PRECISION
- `allocated_amount` DOUBLE PRECISION (current progress)
- `color` VARCHAR(20) (UI color code)
- `is_active` BOOLEAN
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

**Purpose**: Help users set and track savings goals

---

### 6️⃣ **refresh_tokens** (JWT Token Management)
- `id` INTEGER PRIMARY KEY
- `user_id` INTEGER → FK(users.id)
- `token` VARCHAR(500) UNIQUE
- `expires_at` TIMESTAMP
- `created_at` TIMESTAMP

**Purpose**: Manage refresh tokens for authentication

---

### 7️⃣ **token_blacklist** (Revoked Tokens)
- `id` INTEGER PRIMARY KEY
- `token` VARCHAR(500) UNIQUE
- `blacklisted_at` TIMESTAMP

**Purpose**: Track invalidated/logged-out tokens

---

## 🔗 Entity Relationships

```
users (1) ──── (M) bank_accounts
  │                    │
  │                    │
  │                    ├──── (M) transactions
  │                    │
  │                    └──── (M) transfer_transactions
  │
  ├──── (M) transactions
  │
  ├──── (M) savings_goals
  │
  └──── (M) refresh_tokens


Relationships:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. users → bank_accounts (One-to-Many)
   One user can have multiple bank accounts

2. users → transactions (One-to-Many)
   One user can have multiple transactions

3. bank_accounts → transactions (One-to-Many)
   One account can have multiple transactions

4. bank_accounts → transfer_transactions (One-to-Many)
   One account can be sender in multiple transfers

5. transfer_transactions → transactions (One-to-One/Many)
   Each transfer can link to transaction records

6. users → savings_goals (One-to-Many)
   One user can have multiple savings goals

7. bank_accounts → savings_goals (One-to-Many)
   One account can fund multiple savings goals

8. users → refresh_tokens (One-to-Many)
   One user can have multiple active refresh tokens
```

---

## 📈 Database Statistics

- **Total Tables**: 7
- **Total Relationships**: 8 Foreign Keys
- **Indexed Columns**: 14 indexes for query optimization
- **Authentication Tables**: 3 (users, refresh_tokens, token_blacklist)
- **Financial Tables**: 4 (bank_accounts, transactions, transfer_transactions, savings_goals)

---

## 🔐 Security Features

1. **Password Hashing**: bcrypt for secure password storage
2. **JWT Authentication**: Access + Refresh token pattern
3. **Token Blacklisting**: Revoked tokens tracked
4. **User Verification**: Email verification system ready
5. **Soft Delete**: is_active flags for data retention

---

## 💡 Key Design Decisions

1. **Amount Storage**: Integer (cents) to avoid floating-point precision issues
2. **Timezone**: UTC timestamps for consistency
3. **Cascade Deletes**: Foreign keys maintain referential integrity
4. **Indexes**: Optimized for common queries (username, email, account_number)
5. **Audit Trail**: created_at/updated_at timestamps on all tables
