#!/bin/bash
#
# Music Bot Dependencies Installation Script
# This script installs and updates all required system dependencies for the music bot
# 
# Usage: sudo bash install-dependencies.sh
#
# Requirements:
# - Ubuntu/Debian-based Linux distribution
# - Root/sudo access
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Music Bot Dependencies Installer${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}âš ï¸  This script should be run with sudo for system package installation${NC}"
    echo "   Run: sudo bash install-dependencies.sh"
    exit 1
fi

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
else
    echo -e "${RED}âŒ Could not detect package manager. Please install dependencies manually.${NC}"
    exit 1
fi

echo -e "${GREEN}âœ… Detected package manager: ${PKG_MANAGER}${NC}"
echo ""

# ============================================
# 1. Update System Packages
# ============================================
echo -e "${BLUE}í³¦ Step 1: Updating system packages...${NC}"

case $PKG_MANAGER in
    apt)
        apt-get update -y
        apt-get upgrade -y
        ;;
    yum)
        yum update -y
        ;;
    dnf)
        dnf update -y
        ;;
    pacman)
        pacman -Syu --noconfirm
        ;;
esac

echo -e "${GREEN}âœ… System packages updated${NC}"
echo ""

# ============================================
# 2. Install Build Essentials
# ============================================
echo -e "${BLUE}í´§ Step 2: Installing build tools...${NC}"

case $PKG_MANAGER in
    apt)
        apt-get install -y build-essential gcc g++ make python3 python3-pip git curl wget
        ;;
    yum)
        yum groupinstall -y "Development Tools"
        yum install -y python3 python3-pip git curl wget
        ;;
    dnf)
        dnf groupinstall -y "Development Tools"
        dnf install -y python3 python3-pip git curl wget
        ;;
    pacman)
        pacman -S --noconfirm base-devel python python-pip git curl wget
        ;;
esac

echo -e "${GREEN}âœ… Build tools installed${NC}"
echo ""

# ============================================
# 3. Install FFmpeg (Critical for audio)
# ============================================
echo -e "${BLUE}í¾µ Step 3: Installing/Updating FFmpeg...${NC}"

case $PKG_MANAGER in
    apt)
        apt-get install -y ffmpeg
        ;;
    yum)
        # For CentOS/RHEL, FFmpeg might need EPEL or RPM Fusion
        yum install -y epel-release || true
        yum install -y ffmpeg ffmpeg-devel || {
            echo -e "${YELLOW}âš ï¸  FFmpeg not in default repos, trying alternative...${NC}"
            # Try installing from source or snap
            if command -v snap &> /dev/null; then
                snap install ffmpeg
            fi
        }
        ;;
    dnf)
        dnf install -y ffmpeg ffmpeg-devel || {
            echo -e "${YELLOW}âš ï¸  FFmpeg not in default repos, enabling RPM Fusion...${NC}"
            dnf install -y https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm || true
            dnf install -y ffmpeg ffmpeg-devel
        }
        ;;
    pacman)
        pacman -S --noconfirm ffmpeg
        ;;
esac

# Verify FFmpeg installation
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    echo -e "${GREEN}âœ… FFmpeg installed: ${FFMPEG_VERSION}${NC}"
else
    echo -e "${RED}âŒ FFmpeg installation failed. Please install manually.${NC}"
    echo "   Try: sudo snap install ffmpeg"
fi
echo ""

# ============================================
# 4. Install Opus Libraries (for voice)
# ============================================
echo -e "${BLUE}í´Š Step 4: Installing Opus audio libraries...${NC}"

case $PKG_MANAGER in
    apt)
        apt-get install -y libopus0 libopus-dev libogg0 libogg-dev
        ;;
    yum|dnf)
        $PKG_MANAGER install -y opus opus-devel libogg libogg-devel
        ;;
    pacman)
        pacman -S --noconfirm opus libogg
        ;;
esac

echo -e "${GREEN}âœ… Opus libraries installed${NC}"
echo ""

# ============================================
# 5. Install Sodium (for encryption)
# ============================================
echo -e "${BLUE}í´ Step 5: Installing libsodium for encryption...${NC}"

case $PKG_MANAGER in
    apt)
        apt-get install -y libsodium23 libsodium-dev
        ;;
    yum|dnf)
        $PKG_MANAGER install -y libsodium libsodium-devel
        ;;
    pacman)
        pacman -S --noconfirm libsodium
        ;;
esac

echo -e "${GREEN}âœ… Libsodium installed${NC}"
echo ""

# ============================================
# 6. Check Node.js Installation
# ============================================
echo -e "${BLUE}í³— Step 6: Checking Node.js...${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}âœ… Node.js installed: ${NODE_VERSION}${NC}"
    
    # Check if version is 16.11+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -lt 16 ]; then
        echo -e "${YELLOW}âš ï¸  Node.js version is below 16. Updating...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
else
    echo -e "${YELLOW}âš ï¸  Node.js not found. Installing Node.js 20 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Verify npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}âœ… npm installed: v${NPM_VERSION}${NC}"
else
    echo -e "${RED}âŒ npm not found${NC}"
fi
echo ""

# ============================================
# 7. Install PM2 (Process Manager)
# ============================================
echo -e "${BLUE}í´„ Step 7: Installing/Updating PM2...${NC}"

npm install -g pm2@latest

if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 -v)
    echo -e "${GREEN}âœ… PM2 installed: v${PM2_VERSION}${NC}"
fi
echo ""

# ============================================
# 8. Summary
# ============================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Installation Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${GREEN}âœ… All system dependencies installed!${NC}"
echo ""
echo "Installed components:"
echo "  â€¢ Build tools (gcc, g++, make)"
echo "  â€¢ Python 3"
echo "  â€¢ FFmpeg (audio transcoding)"
echo "  â€¢ Opus libraries (Discord voice)"
echo "  â€¢ Libsodium (encryption)"
echo "  â€¢ Node.js & npm"
echo "  â€¢ PM2 (process manager)"
echo ""
echo -e "${YELLOW}í³‹ Next steps:${NC}"
echo "  1. Navigate to your bot directory"
echo "  2. Run: npm install"
echo "  3. Run: npm run build (if using TypeScript)"
echo "  4. Start with: pm2 start ecosystem.config.js"
echo ""
echo -e "${GREEN}í¾µ Your music bot should now be ready to play audio!${NC}"
echo ""

# ============================================
# 9. Version Check
# ============================================
echo -e "${BLUE}í³Š Installed Versions:${NC}"
echo "----------------------------------------"
[ -x "$(command -v node)" ] && echo "Node.js:    $(node -v)"
[ -x "$(command -v npm)" ] && echo "npm:        v$(npm -v)"
[ -x "$(command -v ffmpeg)" ] && echo "FFmpeg:     $(ffmpeg -version 2>&1 | head -n 1 | cut -d' ' -f3)"
[ -x "$(command -v python3)" ] && echo "Python:     $(python3 --version)"
[ -x "$(command -v pm2)" ] && echo "PM2:        v$(pm2 -v)"
[ -x "$(command -v gcc)" ] && echo "GCC:        $(gcc --version | head -n 1)"
echo "----------------------------------------"
