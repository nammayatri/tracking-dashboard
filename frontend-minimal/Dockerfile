# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the app
RUN npm run build

# Install serve globally for the built app
RUN npm install -g serve@14.2.1

# Set environment variable to ensure correct MIME types
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start server with the specific options to handle routing and MIME types correctly
CMD ["serve", "-s", "build", "--cors", "--no-clipboard", "-l", "3000"] 