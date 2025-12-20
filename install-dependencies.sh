#!/bin/bash
#
# Music Bot Dependencies Installation Script
# This script installs and updates all required system dependencies for the music bot
# 
# Usage: sudo bash install-dependencies.sh
#
# Requirements:
# - Ubuntu/Debian or CentOS/RHEL-based Linux distribution
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
    echo -e "${YELLOW}⚠️  This script should be run with sudo for system package installation${NC}"
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
    echo -e "${RED}❌ Could not detect package manager. Please install dependencies manually.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Detected package manager: ${PKG_MANAGER}${NC}"
echo ""

# ============================================
# 0. Fix broken repos (CentOS/RHEL specific)
# ============================================
if [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
    echo -e "${BLUE}🔧 Step 0: Fixing broken repositories...${NC}"
    
    # Disable MEGAsync repo if it exists and is broken
    if [ -f /etc/yum.repos.d/megasync.repo ]; then
        echo "   Disabling broken MEGAsync repository..."
        yum-config-manager --disable MEGAsync 2>/dev/null || sed -i 's/enabled=1/enabled=0/g' /etc/yum.repos.d/megasync.repo || true
    fi
    
    # Clean yum cache to refresh
    echo "   Cleaning package cache..."
    $PKG_MANAGER clean all 2>/dev/null || true
    
    echo -e "${GREEN}✅ Repository issues fixed${NC}"
    echo ""
fi

# ============================================
# 1. Update System Packages
# ============================================
echo -e "${BLUE} Step 1: Updating system packages...${NC}"

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

echo -e "${GREEN}✅ System packages updated${NC}"
echo ""

# ============================================
# 2. Install Build Essentials
# ============================================
echo -e "${BLUE} Step 2: Installing build tools...${NC}"

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

echo -e "${GREEN}✅ Build tools installed${NC}"
echo ""

# ============================================
# 3. Install FFmpeg (Critical for audio)
# ============================================
echo -e "${BLUE}🎵 Step 3: Installing/Updating FFmpeg...${NC}"

case $PKG_MANAGER in
    apt)
        apt-get install -y ffmpeg
        ;;
    yum)
        # For CentOS 7, FFmpeg needs nux-dextop or manual installation
        echo "   Installing FFmpeg for CentOS..."
        
        # Try nux-dextop first (common for CentOS 7)
        if ! rpm -q nux-dextop-release &>/dev/null; then
            echo "   Adding nux-dextop repository..."
            rpm -Uvh http://li.nux.ro/download/nux/dextop/el7/x86_64/nux-dextop-release-0-5.el7.nux.noarch.rpm 2>/dev/null || true
        fi
        
        # Try installing FFmpeg
        yum install -y ffmpeg ffmpeg-devel --skip-broken 2>/dev/null || {
            echo -e "${YELLOW}   FFmpeg not available via yum, trying static binary...${NC}"
            
            # Download static FFmpeg binary as fallback
            if [ ! -f /usr/local/bin/ffmpeg ]; then
                echo "   Downloading static FFmpeg build..."
                cd /tmp
                wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -O ffmpeg-static.tar.xz 2>/dev/null || \
                curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg-static.tar.xz
                
                if [ -f ffmpeg-static.tar.xz ]; then
                    tar xf ffmpeg-static.tar.xz
                    cp ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/
                    cp ffmpeg-*-amd64-static/ffprobe /usr/local/bin/
                    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe
                    rm -rf ffmpeg-*-amd64-static ffmpeg-static.tar.xz
                    echo "   Static FFmpeg installed to /usr/local/bin/"
                fi
                cd - >/dev/null
            fi
        }
        ;;
    dnf)
        dnf install -y ffmpeg ffmpeg-devel || {
            echo -e "${YELLOW}⚠️  FFmpeg not in default repos, enabling RPM Fusion...${NC}"
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
    echo -e "${GREEN}✅ FFmpeg installed: ${FFMPEG_VERSION}${NC}"
elif [ -f /usr/local/bin/ffmpeg ]; then
    FFMPEG_VERSION=$(/usr/local/bin/ffmpeg -version | head -n 1)
    echo -e "${GREEN}✅ FFmpeg installed (static): ${FFMPEG_VERSION}${NC}"
    # Add to PATH for current session
    export PATH="/usr/local/bin:$PATH"
else
    echo -e "${RED}❌ FFmpeg installation failed. Please install manually.${NC}"
    echo "   Manual install: wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
fi
echo ""

# ============================================
# 4. Install Opus Libraries (for voice)
# ============================================
echo -e "${BLUE} Step 4: Installing Opus audio libraries...${NC}"

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

echo -e "${GREEN}✅ Opus libraries installed${NC}"
echo ""

# ============================================
# 5. Install Sodium (for encryption)
# ============================================
echo -e "${BLUE} Step 5: Installing libsodium for encryption...${NC}"

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

echo -e "${GREEN}✅ Libsodium installed${NC}"
echo ""

# ============================================
# 6. Check Node.js Installation
# ============================================
echo -e "${BLUE} Step 6: Checking Node.js...${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js installed: ${NODE_VERSION}${NC}"
    
    # Check if version is 16.11+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -lt 16 ]; then
        echo -e "${YELLOW}⚠️  Node.js version is below 16. Updating...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
else
    echo -e "${YELLOW}⚠️  Node.js not found. Installing Node.js 20 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Verify npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✅ npm installed: v${NPM_VERSION}${NC}"
else
    echo -e "${RED}❌ npm not found${NC}"
fi
echo ""

# ============================================
# 7. Install PM2 (Process Manager)
# ============================================
echo -e "${BLUE} Step 7: Installing/Updating PM2...${NC}"

npm install -g pm2@latest

if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 -v)
    echo -e "${GREEN}✅ PM2 installed: v${PM2_VERSION}${NC}"
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

echo -e "${GREEN}✅ All system dependencies installed!${NC}"
echo ""
echo "Installed components:"
echo "  • Build tools (gcc, g++, make)"
echo "  • Python 3"
echo "  • FFmpeg (audio transcoding)"
echo "  • Opus libraries (Discord voice)"
echo "  • Libsodium (encryption)"
echo "  • Node.js & npm"
echo "  • PM2 (process manager)"
echo ""
echo -e "${YELLOW} Next steps:${NC}"
echo "  1. Navigate to your bot directory"
echo "  2. Run: npm install"
echo "  3. Run: npm run build (if using TypeScript)"
echo "  4. Start with: pm2 start ecosystem.config.js"
echo ""
echo -e "${GREEN} Your music bot should now be ready to play audio!${NC}"
echo ""

# ============================================
# 9. Version Check
# ============================================
echo -e "${BLUE} Installed Versions:${NC}"
echo "----------------------------------------"
[ -x "$(command -v node)" ] && echo "Node.js:    $(node -v)"
[ -x "$(command -v npm)" ] && echo "npm:        v$(npm -v)"
[ -x "$(command -v ffmpeg)" ] && echo "FFmpeg:     $(ffmpeg -version 2>&1 | head -n 1 | cut -d' ' -f3)"
[ -x "$(command -v python3)" ] && echo "Python:     $(python3 --version)"
[ -x "$(command -v pm2)" ] && echo "PM2:        v$(pm2 -v)"
[ -x "$(command -v gcc)" ] && echo "GCC:        $(gcc --version | head -n 1)"
echo "----------------------------------------"
