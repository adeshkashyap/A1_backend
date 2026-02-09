#!/bin/sh
# Generate the client
npx prisma generate

# Synchronize database schema (Wait for database to be ready)
echo "Waiting for database connection..."
until npx prisma db push --accept-data-loss; do
  echo "Database is not ready yet... sleeping"
  sleep 2
done

npx prisma db seed

# Start the application
npm start
