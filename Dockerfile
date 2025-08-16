# Use Node 18 LTS
FROM node:18-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the code
COPY . .

# Expose port (Render uses PORT env automatically)
EXPOSE 3000

# Start app
CMD [ "npm", "start" ]



