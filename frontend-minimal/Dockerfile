# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Use npm install instead of npm ci to handle dependency issues better
RUN npm install

# Copy all files
COPY . .

# Build the app
RUN npm run build

# Set up serve for production
RUN npm install -g serve@14.2.1

# Create a serve configuration file
RUN echo '{"public":"build","cleanUrls":true,"rewrites":[{"source":"/**","destination":"/index.html"}],"headers":[{"source":"/**","headers":[{"key":"Cache-Control","value":"no-cache, no-store, must-revalidate"},{"key":"X-Content-Type-Options","value":"nosniff"}]},{"source":"**/*.js","headers":[{"key":"Content-Type","value":"application/javascript; charset=utf-8"}]}]}' > serve.json

# Expose port
EXPOSE 3000

# Start server with the configuration
CMD ["serve", "-l", "3000"] 