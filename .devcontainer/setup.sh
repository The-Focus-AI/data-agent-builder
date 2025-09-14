#!/bin/bash

# Setup script for dev container
set -e

echo "🚀 Setting up Data Agent Builder dev container..."

# Ensure mise is in PATH
export PATH="$HOME/.local/bin:$PATH"

# Install mise if not already installed
if ! command -v mise &> /dev/null; then
    echo "📦 Installing mise..."
    curl https://mise.run | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Install tools specified in mise.toml
echo "🔧 Installing mise tools..."
mise install

# Install project dependencies
echo "📦 Installing project dependencies..."
pnpm install

# Verify installation
echo "✅ Verifying installation..."
node --version
pnpm --version
mise --version

echo "🎉 Dev container setup complete!"
echo ""
echo "Available commands:"
echo "  pnpm test     - Run tests"
echo "  pnpm dev      - Start development server"
echo "  pnpm analyze  - Run Excel analysis tool"
echo "  mise --help   - Show mise help"
