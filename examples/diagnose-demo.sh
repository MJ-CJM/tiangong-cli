#!/bin/bash

# ================================================
# Gemini CLI - Diagnose Command Demo Script
# ================================================
#
# This script demonstrates the usage of the new
# /diagnose command for system diagnostics
#
# Usage:
#   chmod +x examples/diagnose-demo.sh
#   ./examples/diagnose-demo.sh
#
# ================================================

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     GEMINI CLI - DIAGNOSE COMMAND DEMONSTRATION          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section header
print_section() {
    echo ""
    echo -e "${BLUE}━━━ $1 ━━━${NC}"
    echo ""
}

# Function to print command
print_command() {
    echo -e "${YELLOW}\$ $1${NC}"
}

# Check if gemini CLI is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# ================================================
# Demo 1: Basic Diagnostics
# ================================================

print_section "Demo 1: Running Basic Diagnostics"
echo "This will check your system environment, dependencies, and API configuration."
echo ""
print_command "npm start -- /diagnose"
echo ""

# Uncomment to actually run (requires built project)
# npm start -- /diagnose

echo -e "${GREEN}Expected output:${NC}"
cat <<'EOF'
╔══════════════════════════════════════════════════════════╗
║           GEMINI CLI DIAGNOSTICS REPORT                  ║
╚══════════════════════════════════════════════════════════╝

━━━ System ━━━

  ✓ Platform          darwin arm64
  ✓ Node.js           v20.10.0
  ✓ Memory            16.00 GB total, 8.50 GB free
  ✓ Working Directory /Users/you/projects/gemini-cli

━━━ Environment ━━━

  ✓ GEMINI_API_KEY   ✓ Set
  ✓ GEMINI_BASE_URL  https://generativelanguage.googleapis.com (default)
  ✓ HTTP_PROXY       Not set

━━━ Configuration ━━━

  ✓ User Config      ✓ Found at /Users/you/.gemini/settings.json
  ⚠ Project Config   ✗ Not found

━━━ Dependencies ━━━

  ✓ Git              ✓ git version 2.39.0
  ⚠ Docker           ✗ Not installed
     └─ Optional but recommended
  ✓ ripgrep          ✓ ripgrep 13.0.0

━━━ Network ━━━

  ✓ Internet         ✓ Reachable
  ✓ Gemini API       ✓ Reachable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Summary: 12 OK, 2 Warning, 0 Error

  ⚠️  Some optional dependencies are missing. CLI will work but with limited features.
EOF

sleep 2

# ================================================
# Demo 2: JSON Output
# ================================================

print_section "Demo 2: JSON Output Format"
echo "Use --json flag to get machine-readable output."
echo ""
print_command "npm start -- /diagnose --json"
echo ""

echo -e "${GREEN}Expected output (truncated):${NC}"
cat <<'EOF'
[
  {
    "category": "System",
    "checks": [
      {
        "name": "Platform",
        "status": "ok",
        "value": "darwin arm64"
      },
      {
        "name": "Node.js",
        "status": "ok",
        "value": "v20.10.0"
      },
      ...
    ]
  },
  {
    "category": "Environment",
    "checks": [
      {
        "name": "GEMINI_API_KEY",
        "status": "ok",
        "value": "✓ Set"
      },
      ...
    ]
  }
]
EOF

sleep 2

# ================================================
# Demo 3: Error Detection
# ================================================

print_section "Demo 3: Detecting Configuration Issues"
echo "If API key is missing, diagnose will detect it:"
echo ""
print_command "unset GEMINI_API_KEY && npm start -- /diagnose"
echo ""

echo -e "${GREEN}Expected error output:${NC}"
cat <<'EOF'
━━━ Environment ━━━

  ✗ GEMINI_API_KEY   ✗ Not found
     └─ Please set GEMINI_API_KEY environment variable
  ✓ GEMINI_BASE_URL  https://generativelanguage.googleapis.com (default)
  ✓ HTTP_PROXY       Not set

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Summary: 11 OK, 2 Warning, 1 Error

  ⚠️  Critical issues detected. Please resolve errors before using CLI.
EOF

sleep 2

# ================================================
# Use Cases
# ================================================

print_section "Common Use Cases"

cat <<EOF
1. ${GREEN}Before First Run${NC}
   Run diagnose to ensure your environment is properly set up:
   ${YELLOW}npm start -- /diagnose${NC}

2. ${GREEN}Troubleshooting${NC}
   If CLI is not working, diagnose can identify the issue:
   ${YELLOW}npm start -- /diagnose${NC}

3. ${GREEN}CI/CD Integration${NC}
   Use JSON output for automated checks:
   ${YELLOW}npm start -- /diagnose --json | jq '.[] | select(.category == "Environment")'${NC}

4. ${GREEN}Reporting Bugs${NC}
   Include diagnose output when filing issues:
   ${YELLOW}npm start -- /diagnose > diagnostic-report.txt${NC}

5. ${GREEN}Pre-deployment Validation${NC}
   Add to deployment scripts to validate server environment:
   ${YELLOW}npm start -- /diagnose --json && echo "✓ Environment ready"${NC}
EOF

echo ""
print_section "Demo Complete!"
echo ""
echo -e "${GREEN}✅ To try it yourself:${NC}"
echo ""
echo "1. Build the project:"
echo "   ${YELLOW}npm run build${NC}"
echo ""
echo "2. Run diagnose:"
echo "   ${YELLOW}npm start -- /diagnose${NC}"
echo ""
echo "For more information, see:"
echo "   ${BLUE}study/02-commands.md${NC}"
echo ""
