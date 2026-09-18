#!/usr/bin/env python3
"""
Supabase Deployment & Migration Helper Script
Loads credentials from .env or CLI args and runs Supabase CLI commands.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT_DIR / ".env"

def load_env():
    """Simple parser for .env file."""
    env = dict(os.environ)
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("\"'")
                    if key and key not in env:
                        env[key] = val
    return env

def run_cmd(cmd, env=None, check=True):
    """Executes a command and streams output."""
    print(f"\n[RUNNING] {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(
        cmd,
        cwd=ROOT_DIR,
        env=env or os.environ,
        shell=isinstance(cmd, str),
        text=True
    )
    if check and res.returncode != 0:
        print(f"[ERROR] Command failed with return code {res.returncode}")
        sys.exit(res.returncode)
    return res.returncode

def main():
    parser = argparse.ArgumentParser(description="Deploy database schema to Supabase using Supabase CLI")
    parser.add_argument("--token", help="Supabase Access Token (from https://supabase.com/dashboard/account/tokens)")
    parser.add_argument("--project-ref", help="Supabase Project Reference ID (e.g. abcdefghijklmnopqrst)")
    parser.add_argument("--password", help="Supabase PostgreSQL Database Password")
    parser.add_argument("--db-url", help="Direct Supabase PostgreSQL connection string (postgresql://...)")
    parser.add_argument("--seed", action="store_true", help="Seed initial data & RAG knowledge base after migration")
    args = parser.parse_args()

    env = load_env()

    token = args.token or env.get("SUPABASE_ACCESS_TOKEN", "").strip()
    project_ref = args.project_ref or env.get("SUPABASE_PROJECT_REF", "").strip()
    password = args.password or env.get("SUPABASE_DB_PASSWORD", "").strip()
    db_url = args.db_url or env.get("SUPABASE_DATABASE_URL", "").strip()

    cmd_env = dict(env)
    if token:
        cmd_env["SUPABASE_ACCESS_TOKEN"] = token

    print("==================================================")
    print("  Supabase CLI Deployment & Migration Helper")
    print("==================================================")

    # 1. Login if token is provided
    if token:
        print("\n[STEP 1/3] Authenticating with Supabase Access Token...")
        run_cmd(["npx", "supabase", "login", "--token", token], env=cmd_env, check=False)
    else:
        print("\n[INFO] No access token provided in arguments or .env. Using existing CLI session if available.")

    # 2. Migration push
    # Method A: Direct DB URL if provided
    if db_url:
        print("\n[STEP 2/3] Pushing migrations via direct Database URL...")
        # Use postgresql protocol compatible with supabase CLI
        clean_url = db_url.replace("+asyncpg", "").replace("+aiosqlite", "")
        run_cmd(["npx", "supabase", "db", "push", "--db-url", clean_url], env=cmd_env)
    # Method B: Project Ref linking and push
    elif project_ref:
        print(f"\n[STEP 2/3] Linking to Supabase Project: {project_ref}...")
        link_cmd = ["npx", "supabase", "link", "--project-ref", project_ref]
        if password:
            link_cmd.extend(["--password", password])
        run_cmd(link_cmd, env=cmd_env)

        print("\n[STEP 3/3] Pushing database migrations to remote Supabase database...")
        push_cmd = ["npx", "supabase", "db", "push"]
        if password:
            push_cmd.extend(["--password", password])
        run_cmd(push_cmd, env=cmd_env)
    else:
        print("\n[ATTENTION REQUIRED]")
        print("Neither SUPABASE_PROJECT_REF nor SUPABASE_DATABASE_URL was found!")
        print("Please provide your project details in .env or via command line flags:")
        print("  python scripts/deploy_supabase.py --project-ref <REF> --password <PASS> --token <TOKEN>")
        print("  OR fill in SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD in .env")
        sys.exit(1)

    print("\n[SUCCESS] Supabase migrations pushed successfully!")

    # 3. Optional Seeding
    if args.seed:
        print("\n[OPTIONAL SEED] Initializing admin user and Level-1 SEO knowledge chunks...")
        if db_url:
            seed_env = dict(cmd_env)
            # Ensure asyncpg dialect is used for Python async SQLAlchemy
            if "postgresql://" in db_url and "postgresql+asyncpg://" not in db_url:
                seed_env["DATABASE_URL"] = db_url.replace("postgresql://", "postgresql+asyncpg://")
            else:
                seed_env["DATABASE_URL"] = db_url
            run_cmd([sys.executable, "scripts/init_db.py"], env=seed_env, check=False)
        else:
            print("[INFO] To seed initial data via scripts/init_db.py, set SUPABASE_DATABASE_URL in .env.")

if __name__ == "__main__":
    main()
