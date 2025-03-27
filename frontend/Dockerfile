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
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Start server
CMD ["serve", "-s", "dist", "-l", "3000"] 