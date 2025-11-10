# Phase 2: Database Initialization - Execution Guide

**Status**: ✅ READY FOR EXECUTION
**Generated**: 2025-11-10
**Target**: docs.den.lan (10.1.1.27)

---

## CRITICAL INFORMATION - SAVE IMMEDIATELY

### Generated Secure Database Password
```
NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag
```

This password is:
- 43 characters (exceeds 32+ requirement)
- Cryptographically strong (openssl rand -base64 32)
- Required for Phase 3 .env configuration
- **ACTION**: Copy and save this password NOW

### Complete DATABASE_URL for Phase 3
```
postgresql://scrapegoat_user:NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag@postgres.den.lan:5432/scrapegoat
```

---

## EXECUTION FROM docs.den.lan

All commands in this guide should be executed from `docs.den.lan` (10.1.1.27).

### Step 2.1: Password Generation (COMPLETED)
```bash
# Generated password:
DB_PASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag"
echo "Password: $DB_PASSWORD"
```

### Step 2.2: Connect to PostgreSQL Server

```bash
# SSH to postgres.den.lan from docs.den.lan
ssh root@postgres.den.lan
# Enter password: P@ssw0rd

# Once connected to postgres.den.lan, connect to PostgreSQL
sudo -u postgres psql
# You should see the postgres=# prompt
```

### Step 2.3: Create Database and User

Execute the following SQL commands in psql:

```sql
-- Step 2.3: Create Database and User
-- ============================================================================

-- Check if database exists (should return no rows)
SELECT datname FROM pg_database WHERE datname = 'scrapegoat';

-- Drop if exists (CAUTION: This destroys all data!)
DROP DATABASE IF EXISTS scrapegoat;

-- Create database user with generated password
CREATE USER scrapegoat_user WITH PASSWORD 'NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag';

-- Create database owned by scrapegoat_user
CREATE DATABASE scrapegoat OWNER scrapegoat_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat_user;

-- Verify creation (you should see scrapegoat listed with scrapegoat_user as owner)
\l scrapegoat
```

**Expected Output** from `\l scrapegoat`:
```
 Name       | Owner           | Encoding | Locale Provider | Collate | Ctype | ...
-----------+-----------------+----------+-----------------+---------+-------+-----
 scrapegoat | scrapegoat_user | UTF8     | ...             | ...     | ...   | ...
```

### Step 2.4: Enable pgvector Extension

Still in psql, execute:

```sql
-- Step 2.4: Enable pgvector Extension
-- ============================================================================

-- Connect to scrapegoat database
\c scrapegoat

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation (should show vector extension with version 0.8.1)
\dx vector

-- Expected Output:
--                      List of installed extensions
--  Name   | Version | Schema |                     Description
-- --------+---------+--------+-----------------------------------------------------
--  vector | 0.8.1   | public | vector data type and ivfflat and hnsw access methods

-- List extension functions (optional verification)
\df *.*vector*

-- Exit psql
\q
```

### Step 2.5: Return to docs.den.lan

```bash
# Exit postgres.den.lan
exit

# You should be back at docs.den.lan prompt
```

### Step 2.6: Test Connection from docs.den.lan

```bash
# Test 1: Check PostgreSQL version from scrapegoat_user
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" \
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "SELECT version();"

# Expected Output: PostgreSQL 18.0 (Ubuntu 18.0-1.pgdg22.04+1) on x86_64-pc-linux-gnu, ...

# Test 2: Verify pgvector extension
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" \
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c \
  "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"

# Expected Output:
#  extname | extversion
# ---------+------------
#  vector  | 0.8.1

# Test 3: Quick connectivity check
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" \
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "SELECT 1 as connection_test;"

# Expected Output:
#  connection_test
# -----------------
#                1
```

### Step 2.7: Document DATABASE_URL

```bash
# Save the connection string for Phase 3
DATABASE_URL="postgresql://scrapegoat_user:NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag@postgres.den.lan:5432/scrapegoat"
echo "DATABASE_URL=$DATABASE_URL"
```

---

## TROUBLESHOOTING

### Cannot Connect via SSH
- Verify docs.den.lan can reach postgres.den.lan: `ping postgres.den.lan`
- Check SSH port: `nc -zv postgres.den.lan 22`
- Verify root password: P@ssw0rd
- Check SSH key permissions if using key auth

### PostgreSQL Connection Refused
- Verify port 5432 is open: `nc -zv postgres.den.lan 5432`
- Check PostgreSQL is running on postgres.den.lan
- Verify postgres user credentials: postgres / Mustiness-Grit7-Kindling

### Cannot Create Database User
- Verify you're connected as postgres user (check prompt shows `postgres=#`)
- Ensure password is exactly: `NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag`
- Check for existing user: `\du scrapegoat_user`
- Drop if exists: `DROP USER IF EXISTS scrapegoat_user;`

### pgvector Extension Not Found
- Verify you connected to scrapegoat database (`\c scrapegoat`)
- Check available extensions: `\dx`
- Verify pgvector is available: `SELECT * FROM pg_available_extensions WHERE name = 'vector';`
- PostgreSQL version must be 18.0 or higher

### Connection Test from docs.den.lan Fails
- Verify password is correct (check for typos)
- Confirm database and user were created: `psql -h postgres.den.lan -U postgres -d postgres -c "SELECT * FROM pg_user WHERE usename='scrapegoat_user';"`
- Check database exists: `psql -h postgres.den.lan -U postgres -d postgres -c "SELECT datname FROM pg_database WHERE datname='scrapegoat';"`
- Test with postgres user first: `PGPASSWORD="Mustiness-Grit7-Kindling" psql -h postgres.den.lan -U postgres -c "SELECT 1;"`

---

## PHASE 2 COMPLETION CHECKLIST

After executing all steps above, verify:

- [ ] SSH connection to postgres.den.lan successful
- [ ] psql connected as postgres user (postgres=# prompt visible)
- [ ] Database 'scrapegoat' created (shown in `\l scrapegoat`)
- [ ] User 'scrapegoat_user' created (visible in `\du`)
- [ ] Privileges granted (GRANT command executed without error)
- [ ] Connected to scrapegoat database (`\c scrapegoat` successful)
- [ ] pgvector extension created (CREATE EXTENSION successful)
- [ ] pgvector visible in `\dx vector` output
- [ ] Version check test passed from docs.den.lan
- [ ] pgvector extension verification passed
- [ ] Connection test with SELECT 1 passed
- [ ] DATABASE_URL documented and saved

**All items checked?** You're ready for Phase 3!

---

## CREDENTIALS SUMMARY

**Keep this information secure - required for Phase 3**

```
Database Password: NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag
Database User: scrapegoat_user
Database Name: scrapegoat
PostgreSQL Host: postgres.den.lan
PostgreSQL Port: 5432

DATABASE_URL=postgresql://scrapegoat_user:NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag@postgres.den.lan:5432/scrapegoat
```

---

## NEXT STEPS: PHASE 3

Once Phase 2 is complete, proceed to Phase 3: File Deployment and Configuration

Phase 3 requires:
1. DATABASE_URL (you have this now)
2. docker-compose.yml file
3. .env file creation with all required variables

Estimated duration: 10 minutes

---

**Generated**: 2025-11-10
**Status**: Ready for Execution
**Location**: /home/mp/Workspace/scrapegoat/projects/scrapegoat-docker-byo-deployment-planning/PHASE2_EXECUTION_GUIDE.md
