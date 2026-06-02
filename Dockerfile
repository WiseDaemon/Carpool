FROM node:20

WORKDIR /app

# Install dependencies for both frontend and backend
COPY package*.json ./
RUN npm install

COPY server/package*.json ./server/
RUN cd server && npm install && npm rebuild sqlite3 --build-from-source

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Change permissions for Hugging Face Spaces (runs as user 1000)
# We need to make sure the app directory and SQLite database are writable
RUN chown -R 1000:1000 /app

USER 1000

# Set environment variables for Hugging Face
ENV PORT=7860
EXPOSE 7860

# Start the unified backend server which also serves the frontend
WORKDIR /app/server
CMD ["node", "server.js"]
