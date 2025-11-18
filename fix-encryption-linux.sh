#!/bin/bash

echo "=========================================="
echo "Discord Music Bot - Encryption Fix Script"
echo "=========================================="
echo ""

# Check Node.js version
echo "1. Checking Node.js version..."
node --version
echo ""

# Check if build tools are installed
echo "2. Checking for build tools..."
if command -v gcc &> /dev/null; then
    echo "✓ GCC installed: $(gcc --version | head -n1)"
else
    echo "✗ GCC not found"
    echo "  Install with: sudo apt-get install build-essential"
fi

if command -v python3 &> /dev/null; then
    echo "✓ Python3 installed: $(python3 --version)"
else
    echo "✗ Python3 not found"
    echo "  Install with: sudo apt-get install python3"
fi
echo ""

# Check current encryption support
echo "3. Checking current encryption support..."
node -e "
try {
  const { generateDependencyReport } = require('@discordjs/voice');
  console.log(generateDependencyReport());
} catch (e) {
  console.log('Error generating report:', e.message);
}
"
echo ""

# Check aes-256-gcm support
echo "4. Checking native aes-256-gcm support..."
node -e "console.log('aes-256-gcm supported:', require('node:crypto').getCiphers().includes('aes-256-gcm'))"
echo ""

echo "=========================================="
echo "FIX STEPS"
echo "=========================================="
echo ""
echo "To fix the encryption issue, run these commands:"
echo ""
echo "# 1. Install build tools (if not already installed):"
echo "sudo apt-get update"
echo "sudo apt-get install -y build-essential python3 libsodium-dev"
echo ""
echo "# 2. Remove node_modules and package-lock.json:"
echo "rm -rf node_modules package-lock.json"
echo ""
echo "# 3. Reinstall dependencies (this will rebuild native modules):"
echo "npm install"
echo ""
echo "# 4. Verify the fix:"
echo "node -e \"const { generateDependencyReport } = require('@discordjs/voice'); console.log(generateDependencyReport());\""
echo ""
echo "=========================================="
