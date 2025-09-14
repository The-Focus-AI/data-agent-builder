# Use the official Node.js image as base
FROM node:20-bullseye

# Install mise
RUN curl https://mise.run | sh

# Add mise to PATH
ENV PATH="/root/.local/bin:${PATH}"

# Set the working directory
WORKDIR /workspaces/data-agent-builder

# Copy mise configuration
COPY mise.toml ./

# Install mise tools
RUN mise install

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy the rest of the application
COPY . .

# Set the default command
CMD ["bash"]
