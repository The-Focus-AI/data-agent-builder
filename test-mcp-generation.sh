#!/bin/bash

# Test script for MCP server generation
# This script tests the complete workflow: analyze data, import it, and generate an MCP server

set -e  # Exit on error

echo "========================================"
echo "Testing MCP Server Generation"
echo "========================================"

# Create test workspace
TEST_WORKSPACE="./test-workspace"
rm -rf "$TEST_WORKSPACE"
mkdir -p "$TEST_WORKSPACE"

echo ""
echo "Step 1: Running data analysis and import..."
echo "Using test file: test-data/test.xlsx"
echo ""

# Run the analysis tool with an initial prompt that completes the full workflow
pnpm exec tsx src/analyzeFile.ts \
  "test-data/test.xlsx" \
  "$TEST_WORKSPACE" \
  "Please analyze this Excel file, import all data into SQLite, and then generate an MCP server. Use the default table name based on the data content."

echo ""
echo "========================================"
echo "Test Results"
echo "========================================"

# Check if expected files were created
echo ""
echo "Generated files in $TEST_WORKSPACE:"
ls -la "$TEST_WORKSPACE"

echo ""
echo "Checking for required files:"
[ -f "$TEST_WORKSPACE/data.db" ] && echo "✓ data.db created" || echo "✗ data.db missing"
[ -f "$TEST_WORKSPACE/parserConfig.json" ] && echo "✓ parserConfig.json created" || echo "✗ parserConfig.json missing"
[ -f "$TEST_WORKSPACE/dataLoaderMetadata.json" ] && echo "✓ dataLoaderMetadata.json created" || echo "✗ dataLoaderMetadata.json missing"
[ -d "$TEST_WORKSPACE/mcp-server" ] && echo "✓ mcp-server directory created" || echo "✗ mcp-server directory missing"

if [ -d "$TEST_WORKSPACE/mcp-server" ]; then
    echo ""
    echo "MCP Server contents:"
    ls -la "$TEST_WORKSPACE/mcp-server"

    echo ""
    echo "MCP Server structure:"
    tree "$TEST_WORKSPACE/mcp-server" -L 2 || find "$TEST_WORKSPACE/mcp-server" -type f

    # Check key MCP server files
    echo ""
    echo "Checking MCP server files:"
    [ -f "$TEST_WORKSPACE/mcp-server/package.json" ] && echo "✓ package.json" || echo "✗ package.json missing"
    [ -f "$TEST_WORKSPACE/mcp-server/tsconfig.json" ] && echo "✓ tsconfig.json" || echo "✗ tsconfig.json missing"
    [ -f "$TEST_WORKSPACE/mcp-server/README.md" ] && echo "✓ README.md" || echo "✗ README.md missing"
    [ -f "$TEST_WORKSPACE/mcp-server/src/index.ts" ] && echo "✓ src/index.ts" || echo "✗ src/index.ts missing"

    echo ""
    echo "Preview of generated README:"
    head -30 "$TEST_WORKSPACE/mcp-server/README.md"
fi

echo ""
echo "========================================"
echo "Test Complete!"
echo "========================================"
