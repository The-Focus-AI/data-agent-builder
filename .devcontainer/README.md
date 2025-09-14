# Dev Container Setup

This dev container provides a consistent development environment for the Data Agent Builder project using mise for tool management.

## What's Included

- **Node.js 24** (via mise)
- **pnpm** (latest version)
- **mise** for tool management
- **TypeScript** support
- **Git** and **GitHub CLI**
- **VS Code extensions** for optimal development experience

## Getting Started

1. **Open in Dev Container**: Use VS Code's "Reopen in Container" command
2. **Automatic Setup**: The container will automatically install mise and project dependencies
3. **Ready to Code**: All tools and dependencies will be available immediately

## Available Commands

Once the container is running, you can use:

```bash
# Run tests
pnpm test

# Start development server
pnpm dev

# Run Excel analysis tool
pnpm analyze

# Check mise status
mise status

# Install additional tools via mise
mise install <tool-name>
```

## Features

- **Consistent Environment**: Same Node.js and tool versions across all machines
- **mise Integration**: Automatic tool installation and management
- **VS Code Integration**: Pre-configured extensions and settings
- **Port Forwarding**: Automatic port forwarding for development servers

## Troubleshooting

If you encounter issues:

1. **Rebuild Container**: Use "Rebuild Container" in VS Code
2. **Check mise**: Run `mise status` to verify tool installations
3. **Reinstall Dependencies**: Run `pnpm install` if needed

## Customization

The dev container configuration can be modified in:
- `.devcontainer/devcontainer.json` - Main container configuration
- `.devcontainer/setup.sh` - Setup script
- `mise.toml` - Tool versions and tasks
