# Use Node.js 20
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]

